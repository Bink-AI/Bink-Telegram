import { Module, OnApplicationBootstrap, Global } from "@nestjs/common";
import { DatabaseModule } from "@/database";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QueueModule } from "@/queue/queue.module";
import { TokenService } from "./services/token.service";
import { UserService } from "./services/user.service";
import { Connection } from "@solana/web3.js";
import Redis from "ioredis";
import { OnchainService } from "./services/onchain.service";
import { SolPriceService } from "./services/sol-price.service";
import { TransactionService } from "./services/transaction.service";
import { ApiService } from "./services/api.service";
import { ethers } from "ethers";
import { AiService } from "./services/ai.service";
import { FourMemeService } from "./services/fourmeme.service";
import { WalletCronService } from "./services/wallet-cron.service";
import { ClaimService } from './services/claim.service';
const services = [
  TokenService,
  UserService,
  OnchainService,
  SolPriceService,
  TransactionService,
  ApiService,
  AiService,
  FourMemeService,
  ClaimService
];
@Global()
@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [],
    }),
  ],
  providers: [
    ...services,
    {
      provide: "SOLANA_CONNECTION",
      useFactory: () => {
        const rpc = process.env.RPC_URL;
        const connection = new Connection(rpc);
        return connection;
      },
      inject: [],
    },
    {
      provide: "BSC_CONNECTION",
      useFactory: () => {
        const rpc = process.env.BSC_RPC_URL;
        return new ethers.JsonRpcProvider(rpc);
      },
    },
    {
      provide: "ETHEREUM_CONNECTION",
      useFactory: () => {
        const rpc = process.env.ETHEREUM_RPC_URL;
        return new ethers.JsonRpcProvider(rpc);
      },
    },
    {
      provide: "CACHE_MANAGER",
      useFactory: () => {
        const family = process.env.REDIS_FAMILY;
        const url = process.env.REDIS_URL + `?family=${family}`;
        const redis = new Redis(url);
        return redis;
      },
      inject: [ConfigService],
    },
    WalletCronService,
  ],
  exports: [...services, "SOLANA_CONNECTION"],
})
export class BusinessModule implements OnApplicationBootstrap {
  constructor(
    private readonly claimService: ClaimService,
  ) { }

  async onApplicationBootstrap() {
    // await this.claimService.saveClaimTransaction("", "0.01945407", "USDT", "BSC", "BSC", "0x0000000000000000000000000000000000000000", 1745230006);
    // const claims = await this.claimService.getClaimsByUserId("");
    // console.log(claims);
    // const claimableBalances = await this.claimService.getAllClaimableBalances("");
    // console.log(claimableBalances);
  }
}
