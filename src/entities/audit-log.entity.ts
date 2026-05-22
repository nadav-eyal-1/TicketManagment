import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  entityType: string;

  @Column()
  entityId: number;

  @Column()
  action: string;

  /** 'USER' or 'SYSTEM' */
  @Column()
  actor: string;

  /** Null for SYSTEM-initiated actions */
  @Column({ type: 'int', nullable: true })
  performedBy: number | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  timestamp: Date;
}
