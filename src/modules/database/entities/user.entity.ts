import { Entity, Column, OneToOne, OneToMany, Index } from "typeorm";
import { BaseEntity } from "./base.entity";
import { UserReferralEntity } from "./user-referral.entity";

@Entity("users")
export class UserEntity extends BaseEntity {
  @Column({ nullable: true, unique: true })
  wallet_evm_address: string;

  @Column({ nullable: true, unique: true })
  wallet_sol_address: string;

  @Column({ nullable: true, type: "text", select: true })
  encrypted_private_key: string;

  @Column({ nullable: true, select: true })
  encrypted_phrase: string;

  @Column({ nullable: true, unique: true })
  @Index()
  telegram_id: string;

  @Column({ nullable: true })
  telegram_username: string;

  @Column({ nullable: true })
  telegram_name: string;

  @Column({ nullable: true })
  telegram_avatar_url: string;

  @Column({ unique: true })
  referral_code: string;

  @Column({ nullable: true })
  current_thread_id: string;

  @OneToMany(() => UserReferralEntity, (entity) => entity.referrer_user)
  user_referrals: UserReferralEntity[];

  @OneToOne(() => UserReferralEntity, (entity) => entity.referee_user)
  user_referee: UserReferralEntity;
}
