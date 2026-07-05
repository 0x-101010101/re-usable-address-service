import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('deposit_addresses')
@Unique('UQ_user_chain_asset', ['userId', 'depositChain', 'destinationAsset'])
export class AddressEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'deposit_chain' })
  depositChain: string;

  @Column({ name: 'destination_chain' })
  destinationChain: string;

  @Column({ name: 'destination_asset' })
  destinationAsset: string;

  @Column()
  recipient: string;

  @Column({ name: 'deposit_address' })
  @Index()
  depositAddress: string;

  @Column({ name: 'account_id' })
  accountId: string;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  @Column({ name: 'refund_to', type: 'text', nullable: true })
  refundTo: string | null;

  @Column({ name: 'refund_chain', type: 'text', nullable: true })
  refundChain: string | null;

  @Column({ name: 'chain_deposit_addresses', type: 'text', nullable: true })
  chainDepositAddressesJson: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_deposit_at', type: 'datetime', nullable: true })
  lastDepositAt: Date | null;

  @Column({ name: 'deposit_count', type: 'int', default: 0 })
  depositCount: number;

  get chainDepositAddresses(): Record<string, string> | null {
    if (!this.chainDepositAddressesJson) return null;
    try { return JSON.parse(this.chainDepositAddressesJson); } catch { return null; }
  }
}
