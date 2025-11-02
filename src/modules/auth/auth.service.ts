import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenTTL: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: RedisCacheService,
  ) {
    // Refresh token expires in 7 days by default
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    // Parse duration string (e.g., '7d', '30d') to seconds
    const match = refreshExpiresIn.match(/(\d+)([dhms])/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      const multipliers: Record<string, number> = {
        s: 1,
        m: 60,
        h: 3600,
        d: 86400,
      };
      this.refreshTokenTTL = value * (multipliers[unit] || 86400);
    } else {
      // Default to 7 days if parsing fails
      this.refreshTokenTTL = 7 * 24 * 60 * 60;
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Use generic message to prevent email enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const user = await this.usersService.create(registerDto);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    // Verify refresh token and get stored data
    const tokenData = await this.verifyRefreshToken(refreshToken);

    if (!tokenData) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findOne(tokenData.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke old refresh token (token rotation)
    await this.revokeRefreshToken(tokenData.tokenId);

    // Generate new tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeRefreshToken(tokenId?: string) {
    if (tokenId) {
      await this.cacheService.delete(`refresh_token:${tokenId}`);
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string) {
    const pattern = `refresh_token:*:${userId}`;
    await this.cacheService.deleteByPattern(pattern);
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: userId,
      email,
      role,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token ID
    const tokenId = randomBytes(32).toString('hex');

    // Store refresh token metadata in Redis
    const refreshTokenData = {
      userId,
      email,
      role,
      tokenId,
      createdAt: new Date().toISOString(),
    };

    // Store refresh token with rotation support
    const refreshTokenPayload = {
      sub: userId,
      tokenId,
      type: 'refresh',
    };

    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: refreshSecret,
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') || '7d',
    });

    // Store in Redis with TTL
    await this.cacheService.set(
      `refresh_token:${tokenId}:${userId}`,
      refreshTokenData,
      this.refreshTokenTTL,
      { namespace: 'auth' },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Verify refresh token and return stored data
   */
  private async verifyRefreshToken(refreshToken: string): Promise<{
    userId: string;
    tokenId: string;
  } | null> {
    try {
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      if (payload.type !== 'refresh' || !payload.tokenId) {
        return null;
      }

      // Check if token exists in Redis
      const tokenData = await this.cacheService.get<any>(
        `refresh_token:${payload.tokenId}:${payload.sub}`,
        { namespace: 'auth' },
      );

      if (!tokenData) {
        return null;
      }

      return {
        userId: payload.sub,
        tokenId: payload.tokenId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Invalid refresh token: ${message}`);
      return null;
    }
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.usersService.findOne(userId);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  async validateUserRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = await this.usersService.findOne(userId);

    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
} 