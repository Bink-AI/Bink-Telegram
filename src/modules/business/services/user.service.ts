import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import {
  TransactionRepository,
  UserReferralRepository,
  UserRepository,
} from "@/database/repositories";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as CryptoJS from "crypto-js";
import bs58 from "bs58";
import { ConfigService } from "@nestjs/config";
import { CreateUserDto } from "../dto/create-user.dto";
import {
  decryptPrivateKey,
  encryptPrivateKey,
} from "@/telegram-bot/utils/crypto.utils";
import { Redis } from "ioredis";
import {
  getSolBalance,
  getTokenBalance,
} from "@/telegram-bot/utils/solana.utils";
import { ApiService } from "./api.service";
import { TransactionType } from "@/database/entities/transaction.entity";
import { SolPriceService } from "./sol-price.service";
import { OnchainService } from "./onchain.service";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers";
import { makeId } from "@/shared/helper";
import { Contract } from "ethers";
import { formatEther } from "ethers";
import { TelegramBot } from "@/telegram-bot/telegram-bot";
import { v4 as uuidv4 } from "uuid";
@Injectable()
export class UserService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(UserRepository)
    private readonly userRepository: Repository<UserEntity>,
    private readonly userReferralRepository: UserReferralRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly onchainService: OnchainService,
    private readonly solPriceService: SolPriceService,
    private readonly bot: TelegramBot,
    @Inject("CACHE_MANAGER") private cacheManager: Redis,
    @Inject("SOLANA_CONNECTION") private connection: Connection,
    @Inject("BSC_CONNECTION") private bscProvider: JsonRpcProvider,
    @Inject("ETHEREUM_CONNECTION") private ethProvider: JsonRpcProvider
  ) { }

  async onApplicationBootstrap() { }

  async createUser(
    createUserDto: CreateUserDto & {
      telegram_id?: string;
      telegram_username?: string;
      telegram_name?: string;
      telegram_avatar_url?: string;
      address?: string;
      referral_code?: string;
    }
  ) {
    const mnemonic = bip39.generateMnemonic();

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath(
      "m/44'/501'/0'/0'",
      seed.toString("hex")
    ).key;

    const wallet = Keypair.fromSeed(derivedSeed);

    // Create Solana wallet
    const walletAddress = wallet.publicKey.toString();

    const walletEvm = Wallet.fromPhrase(mnemonic);
    const walletEvmAddress = walletEvm.address.toLowerCase();

    // Get encryption key from environment
    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || "123";
    if (!encryptionKey) {
      throw new Error("Wallet encryption key not configured");
    }

    // Encrypt private key
    const encryptedPhrase = encryptPrivateKey(mnemonic, encryptionKey);
    const referralCode = await this.generateReferralCode();
    // Create user with wallet info
    const user = await this.userRepository.save({
      ...createUserDto,
      wallet_sol_address: walletAddress,
      encrypted_private_key: encryptedPhrase,
      wallet_evm_address: walletEvmAddress,
      encrypted_phrase: encryptedPhrase,
      referral_code: referralCode,
      current_thread_id: uuidv4(),
    });

    if (createUserDto.referral_code) {
      const referrer = await this.userRepository.findOne({
        where: { referral_code: createUserDto.referral_code },
      });
      if (referrer && referrer.id !== user.id) {
        await this.userReferralRepository.save({
          referrer_user_id: referrer.id,
          referee_user_id: user.id,
        });
      }
    }


    if (process.env.TELEGRAM_GROUP_ID) {
      const totalUsers = (await this.userRepository.count()) + 1;

      const message =
        `🎉<b> New User Registration !</b>\n` +
        `👤 Name: ${user.telegram_name}\n` +
        `👤 Username: ${user.telegram_username}\n` +
        `👥 Total Users: ${totalUsers} `;

      this.bot
        .sendMessage(
          process.env.TELEGRAM_GROUP_ID,
          message,
          {
            message_thread_id: Number(process.env.TELEGRAM_THREAD_ID),
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }
        )
        .then()
        .catch((error) => {
          console.error('Error sending message to Telegram group:', error);
        });
    }

    return user;
  }

  private async generateReferralCode() {
    let refCode: string;
    while (true) {
      refCode = makeId(6).toLowerCase();
      if (
        !(await this.userRepository.exists({
          where: { referral_code: refCode },
        }))
      ) {
        break;
      }
    }
    return refCode;
  }

  private async createUserWithTelegramInfo(
    createUserDto: CreateUserDto & {
      telegram_id?: string;
      telegram_username?: string;
      telegram_name?: string;
      telegram_avatar_url?: string;
      referral_code?: string;
    }
  ): Promise<UserEntity> {
    const referralCode = await this.generateReferralCode();

    // Create user with only telegram info first
    const user = await this.userRepository.save({
      ...createUserDto,
      referral_code: referralCode,
      current_thread_id: uuidv4(),
    });


    if (createUserDto.referral_code) {
      const referrer = await this.userRepository.findOne({
        where: { referral_code: createUserDto.referral_code },
      });
      if (referrer && referrer.id !== user.id) {
        await this.userReferralRepository.save({
          referrer_user_id: referrer.id,
          referee_user_id: user.id,
        });
      }
    }

    if (process.env.TELEGRAM_GROUP_ID) {
      const totalUsers = (await this.userRepository.count()) + 1;

      const message =
        `🎉<b> New User Registration !</b>\n` +
        `👤 Name: ${user.telegram_name}\n` +
        `👤 Username: ${user.telegram_username}\n` +
        `👥 Total Users: ${totalUsers} `;

      this.bot
        .sendMessage(
          process.env.TELEGRAM_GROUP_ID,
          message,
          {
            message_thread_id: Number(process.env.TELEGRAM_THREAD_ID),
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }
        )
        .then()
        .catch((error) => {
          console.error('Error sending message to Telegram group:', error);
        });
    }

    return user;
  }

  async findUsersWithoutWallets(limit: number): Promise<UserEntity[]> {
    return this.userRepository.find({
      where: {
        wallet_sol_address: IsNull(),
        wallet_evm_address: IsNull()
      },
      take: limit
    });
  }

  async createWalletForUser(user: UserEntity): Promise<void> {
    // Generate wallet info
    const mnemonic = bip39.generateMnemonic();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath(
      "m/44'/501'/0'/0'",
      seed.toString("hex")
    ).key;
    const wallet = Keypair.fromSeed(derivedSeed);
    const walletAddress = wallet.publicKey.toString();
    const walletEvm = Wallet.fromPhrase(mnemonic);
    const walletEvmAddress = walletEvm.address.toLowerCase();

    // Get encryption key from environment
    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || "123";
    if (!encryptionKey) {
      throw new Error("Wallet encryption key not configured");
    }

    // Encrypt private key
    const encryptedPhrase = encryptPrivateKey(mnemonic, encryptionKey);

    // Update user with wallet info
    await this.userRepository.update(user.id, {
      wallet_sol_address: walletAddress,
      encrypted_private_key: encryptedPhrase,
      wallet_evm_address: walletEvmAddress,
      encrypted_phrase: encryptedPhrase
    });
  }

  async getOrCreateUser(
    createUserDto: CreateUserDto & {
      telegram_id?: string;
      telegram_username?: string;
      telegram_name?: string;
      telegram_avatar_url?: string;
      referral_code?: string;
    }
  ): Promise<UserEntity> {
    // Check if user exists by telegram_id
    if (createUserDto.telegram_id) {
      const existingUser = await this.userRepository.findOne({
        where: { telegram_id: createUserDto.telegram_id },
      });

      if (existingUser) {
        //add current_thread_id if not exists
        if (!existingUser.current_thread_id) {
          existingUser.current_thread_id = uuidv4();
          await this.userRepository.save(existingUser);
        }
        return existingUser;
      }
    }

    // First create user with telegram info
    const user = await this.createUserWithTelegramInfo(createUserDto);

    // Return user without wallet info
    return user;
  }

  async getUserById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }


  async getEncryptedPrivateKeyByTelegramId(
    telegramId: string
  ): Promise<{ encryptedPhrase: string; encryptedPrivateKey: string } | null> {
    const user = await this.userRepository.findOne({
      select: ["encrypted_phrase", "encrypted_private_key"],
      where: { telegram_id: telegramId },
    });

    if (!user) return null;

    return {
      encryptedPhrase: user.encrypted_phrase,
      encryptedPrivateKey: user.encrypted_private_key,
    };
  }

  async getMnemonicByTelegramId(telegramId: string): Promise<string | null> {
    const encryptedKeys =
      await this.getEncryptedPrivateKeyByTelegramId(telegramId);
    if (!encryptedKeys) return null;

    //decode encrypted phrase
    const mnemonic = decryptPrivateKey(
      encryptedKeys.encryptedPhrase,
      process.env.WALLET_ENCRYPTION_KEY || "123"
    );
    return mnemonic;
  }

  async getPrivateKeyByTelegramId(telegramId: string): Promise<{
    evmPrivateKey: string;
    solanaPrivateKey: string;
  } | null> {
    const encryptedKeys =
      await this.getEncryptedPrivateKeyByTelegramId(telegramId);
    if (!encryptedKeys) return null;

    //decode encrypted phrase
    const mnemonic = decryptPrivateKey(
      encryptedKeys.encryptedPhrase,
      process.env.WALLET_ENCRYPTION_KEY || "123"
    );
    const walletEvm = Wallet.fromPhrase(mnemonic);

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath(
      "m/44'/501'/0'/0'",
      seed.toString("hex")
    ).key;
    const solPrivateKey = Keypair.fromSeed(derivedSeed);
    const solanaPrivateKey = bs58.encode(solPrivateKey.secretKey);
    return {
      evmPrivateKey: walletEvm.privateKey,
      solanaPrivateKey: solanaPrivateKey,
    };
  }

  async getSolBalance(telegramId: string) {
    const cacheKey = `solana_balance:${telegramId}`;
    const cachedBalance = await this.cacheManager.get(cacheKey);
    if (cachedBalance) {
      return cachedBalance;
    }
    const user = await this.userRepository.findOne({
      where: { telegram_id: telegramId },
    });
    if (!user) {
      throw new Error("User not found");
    }
    const publicKey = new PublicKey(user.wallet_sol_address);
    const balance = await getSolBalance(this.connection, publicKey);
    await this.cacheManager.set(cacheKey, balance, "EX", 30); // 30s
    return balance;
  }

  async getTokenBalance(telegramId: string, mintAddress: string) {
    const cacheKey = `token_balance:${telegramId}:${mintAddress}`;

    const cachedBalance = await this.cacheManager.get(cacheKey);
    if (cachedBalance) {
      return Number(cachedBalance);
    }

    const user = await this.userRepository.findOne({
      where: { telegram_id: telegramId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const publicKey = new PublicKey(user.wallet_sol_address);
    const mintPublicKey = new PublicKey(mintAddress);

    const balance = await getTokenBalance(
      this.connection,
      publicKey,
      mintPublicKey
    );

    // await this.cacheManager.set(cacheKey, balance, "EX", 0);

    return balance;
  }

  async calculateTokenPNL(
    telegramId: string,
    tokenAddress: string
  ): Promise<{
    pnl: number;
    pnlUsd: number;
    totalBuyUsd: number;
    totalSellUsd: number;
    totalBuySol: number;
    totalSellSol: number;
    netValue: number;
  }> {
    // Get user information
    const user = await this.userRepository.findOne({
      where: { telegram_id: telegramId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get all user transactions for this token
    const transactions = await this.transactionRepository.find({
      where: {
        user_id: user.id,
        token_address: tokenAddress,
      },
    });

    // Calculate total value of buy and sell orders
    let totalBuySol = 0;
    let totalSellSol = 0;
    let totalBuyUsd = 0;
    let totalSellUsd = 0;

    transactions.forEach((tx) => {
      if (tx.type === TransactionType.BUY) {
        totalBuySol += Number(tx.sol_amount);
        totalBuyUsd += Number(tx.sol_amount_by_usd);
      } else if (tx.type === TransactionType.SELL) {
        totalSellSol += Number(tx.sol_amount);
        totalSellUsd += Number(tx.sol_amount_by_usd);
      }
    });

    // Get current balance and current price
    const [currentBalance, solPrice] = await Promise.all([
      this.getTokenBalance(telegramId, tokenAddress),
      this.solPriceService.getSolPrice(),
      this.onchainService.fetchAndPersistBondingCurve(tokenAddress),
    ]);
    const sellPrice = this.onchainService.calculateSellPumpAmount(
      tokenAddress,
      1
    );
    const currentPrice = sellPrice;
    const currentPriceUsd = Number(currentPrice) * Number(solPrice);

    // Calculate current value of balance
    const currentValue = (currentBalance || 0) * currentPrice;
    const currentValueUsd = (currentBalance || 0) * currentPriceUsd;

    // Calculate PNL percentage
    if (totalBuySol === 0) {
      return {
        pnl: 0,
        pnlUsd: 0,
        totalBuyUsd: 0,
        totalSellUsd: 0,
        totalBuySol: 0,
        totalSellSol: 0,
        netValue: 0,
      }; // Avoid division by zero
    }

    const pnl =
      ((totalSellSol + currentValue - totalBuySol) / totalBuySol) * 100;
    const pnlUsd =
      ((totalSellUsd + currentValueUsd - totalBuyUsd) / totalBuyUsd) * 100;
    const netValue = totalSellUsd + currentValueUsd - totalBuyUsd;

    return {
      pnl,
      pnlUsd,
      totalBuyUsd,
      totalSellUsd,
      totalBuySol,
      totalSellSol,
      netValue,
    };
  }

  async getBnbBalance(address: string) {
    const cacheKey = `bnb_balance:${address}`;
    const cachedBalance = await this.cacheManager.get(cacheKey);
    if (cachedBalance) {
      return Number(cachedBalance);
    }

    const balance = await this.bscProvider.getBalance(address);
    const formattedBalance = Number(balance) / 1e18; // Convert from wei to BNB

    await this.cacheManager.set(
      cacheKey,
      formattedBalance.toString(),
      "EX",
      30
    ); // 30s cache
    return formattedBalance;
  }

  async getEthBalance(address: string) {
    const cacheKey = `eth_balance:${address}`;
    const cachedBalance = await this.cacheManager.get(cacheKey);
    if (cachedBalance) {
      return Number(cachedBalance);
    }

    const balance = await this.ethProvider.getBalance(address);
    const formattedBalance = Number(balance) / 1e18; // Convert from wei to ETH

    await this.cacheManager.set(
      cacheKey,
      formattedBalance.toString(),
      "EX",
      30
    ); // 30s cache
    return formattedBalance;
  }

  async getWalletBalances(telegramId: string) {
    const user = await this.userRepository.findOne({
      where: { telegram_id: telegramId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const [solBalance, bnbBalance, ethBalance] = await Promise.all([
      this.getSolBalance(telegramId),
      this.getBnbBalance(user.wallet_evm_address),
      this.getEthBalance(user.wallet_evm_address),
    ]);

    return {
      solana: solBalance,
      bnb: bnbBalance,
      ethereum: ethBalance,
    };
  }

  async getTokenBalanceByNetwork(
    telegramId: string,
    network: "solana" | "bsc" | "ethereum",
    tokenAddress: string
  ) {
    const user = await this.userRepository.findOne({
      where: { telegram_id: telegramId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // const cacheKey = `token_balance:${network}:${telegramId}:${tokenAddress}`;
    // const cachedBalance = await this.cacheManager.get(cacheKey);
    // if (cachedBalance) {
    //   return Number(cachedBalance);
    // }

    let balance = 0;
    switch (network) {
      case "solana":
        balance = await this.getTokenBalance(telegramId, tokenAddress);
        break;
      case "bsc":
        balance = await this.getBep20TokenBalance(
          user.wallet_evm_address,
          tokenAddress
        );
        break;
      case "ethereum":
        balance = await this.getErc20TokenBalance(
          user.wallet_evm_address,
          tokenAddress
        );
        break;
    }

    // await this.cacheManager.set(cacheKey, balance, "EX", 30); // Cache for 30 seconds
    return balance;
  }

  async getBep20TokenBalance(
    address: string,
    tokenAddress: string
  ): Promise<number> {
    try {
      const abi = ["function balanceOf(address) view returns (uint256)"];
      const contract = new Contract(tokenAddress, abi, this.bscProvider);
      const balance = await contract.balanceOf(address);
      return Number(formatEther(balance));
    } catch (error) {
      console.error("Error getting BEP20 token balance:", error);
      return 0;
    }
  }

  async getErc20TokenBalance(
    address: string,
    tokenAddress: string
  ): Promise<number> {
    try {
      const abi = ["function balanceOf(address) view returns (uint256)"];
      const contract = new Contract(tokenAddress, abi, this.ethProvider);
      const balance = await contract.balanceOf(address);
      return Number(formatEther(balance));
    } catch (error) {
      console.error("Error getting ERC20 token balance:", error);
      return 0;
    }
  }

  async updateCurrentThreadId(telegramId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { telegram_id: telegramId },
    });

    if (user) {
      user.current_thread_id = uuidv4();
      await this.userRepository.save(user);
    }
  }
}
