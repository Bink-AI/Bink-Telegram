import { DataSource, Repository } from "typeorm";
import { InjectDataSource } from "@nestjs/typeorm";
import { TransactionEntity, TransactionStatus, TransactionType } from "../entities/transaction.entity";

export class TransactionRepository extends Repository<TransactionEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(TransactionEntity, dataSource.createEntityManager());
  }

  async findByUserId(userId: string): Promise<TransactionEntity[]> {
    return this.createQueryBuilder("transaction")
      .where("transaction.user_id = :userId", { userId })
      .orderBy("transaction.created_at", "DESC")
      .getMany();
  }

  async findByTxHash(txHash: string): Promise<TransactionEntity> {
    return this.createQueryBuilder("transaction")
      .where("transaction.tx_hash = :txHash", { txHash })
      .getOne();
  }
  
  async createTransaction(transactionData: Partial<TransactionEntity>): Promise<TransactionEntity> {
    const transaction = this.create(transactionData);
    return this.save(transaction);
  }
  
  async updateTransactionStatus(txHash: string, status: TransactionStatus): Promise<void> {
    await this.update({ tx_hash: txHash }, { status });
  }
  
  async findByUserIdAndType(userId: string, type: TransactionType): Promise<TransactionEntity[]> {
    return this.createQueryBuilder("transaction")
      .where("transaction.user_id = :userId", { userId })
      .andWhere("transaction.type = :type", { type })
      .orderBy("transaction.created_at", "DESC")
      .getMany();
  }
  
  async findByUserIdAndStatus(userId: string, status: TransactionStatus): Promise<TransactionEntity[]> {
    return this.createQueryBuilder("transaction")
      .where("transaction.user_id = :userId", { userId })
      .andWhere("transaction.status = :status", { status })
      .orderBy("transaction.created_at", "DESC")
      .getMany();
  }
  
  async findByTokenSymbol(tokenSymbol: string): Promise<TransactionEntity[]> {
    return this.createQueryBuilder("transaction")
      .where("transaction.token_symbol = :tokenSymbol", { tokenSymbol })
      .orderBy("transaction.created_at", "DESC")
      .getMany();
  }
  
  async findByNetworkAndProvider(network: string, provider: string): Promise<TransactionEntity[]> {
    return this.createQueryBuilder("transaction")
      .where("transaction.network = :network", { network })
      .andWhere("transaction.provider = :provider", { provider })
      .orderBy("transaction.created_at", "DESC")
      .getMany();
  }
  
  async findPendingTransactions(): Promise<TransactionEntity[]> {
    return this.createQueryBuilder("transaction")
      .where("transaction.status = :status", { status: TransactionStatus.INIT })
      .orderBy("transaction.created_at", "ASC")
      .getMany();
  }
  
  async countTransactionsByUserAndType(userId: string, type: TransactionType): Promise<number> {
    return this.createQueryBuilder("transaction")
      .where("transaction.user_id = :userId", { userId })
      .andWhere("transaction.type = :type", { type })
      .getCount();
  }
  
  async saveUnstakeTransaction(
    userId: string, 
    amount: string, 
    tokenSymbol: string, 
    network: string, 
    provider: string, 
    txHash: string,
    status: TransactionStatus = TransactionStatus.INIT
  ): Promise<TransactionEntity> {
    const transaction = this.create({
      user_id: userId,
      token_amount: parseFloat(amount),
      token_symbol: tokenSymbol,
      network,
      provider,
      tx_hash: txHash,
      type: TransactionType.UNSTAKE,
      status
    });
    
    return this.save(transaction);
  }

  async saveClaimTransaction(
    userId: string,
    amount: string,
    tokenSymbol: string,
    network: string,
    provider: string,
    txHash: string,
    claim_time: number,
    status: TransactionStatus = TransactionStatus.INIT,
  ): Promise<TransactionEntity> {
    const transaction = this.create({
      user_id: userId,
      token_amount: parseFloat(amount),
      token_symbol: tokenSymbol,
      network,
      provider,
      tx_hash: txHash,
      type: TransactionType.CLAIM,
      status,
      claim_time
    });
    
    return this.save(transaction);
  }
}
