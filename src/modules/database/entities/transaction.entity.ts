import { Column, Entity, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./base.entity";
import { UserEntity } from "./user.entity";

export enum TransactionType {
  BUY = "buy",
  SELL = "sell",
  CLAIM = "claim",
  UNSTAKE = "unstake",
  
}

export enum TransactionStatus {
  INIT = "init",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("transactions")
export class TransactionEntity extends BaseEntity {

  @Column("decimal", { precision: 18, scale: 9, nullable: true })
  sol_amount: number;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  sol_amount_by_usd: number;

  @Column("decimal", { precision: 18, scale: 9, nullable: true })
  token_amount: number;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  token_amount_by_usd: number;

  @Column()
  tx_hash: string;

  @Column({ nullable: true })
  network: string;

  @Column({ nullable: true })
  provider: string;

  @Column({ nullable: true })
  token_symbol: string;

  @Column({ nullable: true })
  claim_time: number;

  @Column({ nullable: true })
  @Index()
  token_address: string;

  @Column({ nullable: true })
  type: TransactionType;

  @Column({ default: TransactionStatus.INIT })
  status: TransactionStatus;

  @Column({ nullable: true })
  error: string;

  @Column()
  @Index()
  user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: "user_id" })
  user: UserEntity;
}
