import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1710752401000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Indexes for tasks table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_priority" ON "tasks" ("priority")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_user_id" ON "tasks" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks" ("due_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_created_at" ON "tasks" ("created_at")
    `);

    // Composite index for common query patterns: status + priority
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_status_priority" ON "tasks" ("status", "priority")
    `);

    // Composite index for user + status (common filter pattern)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_user_status" ON "tasks" ("user_id", "status")
    `);

    // Index for sorting by due date
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_due_date_desc" ON "tasks" ("due_date" DESC NULLS LAST)
    `);

    // Index for users table - role is already used in queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role")
    `);

    // Email is already unique, so it has an index, but let's ensure it
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email_unique" ON "users" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_due_date_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_status_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_due_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_status"`);
  }
}

