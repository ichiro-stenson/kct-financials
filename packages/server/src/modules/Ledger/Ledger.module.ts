import { Module } from '@nestjs/common';
import { LedgerStorageService } from './LedgerStorage.service';
import { LedgerEntriesStorageService } from './LedgerEntriesStorage.service';
import { LedgerRevertService } from './LedgerStorageRevert.service';
import { LedgerContactsBalanceStorage } from './LedgerContactStorage.service';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { LedegrAccountsStorage } from './LedgetAccountStorage.service';
import { AccountsModule } from '../Accounts/Accounts.module';

@Module({
  imports: [TenancyModule, AccountsModule],
  providers: [
    LedgerStorageService,
    LedgerEntriesStorageService,
    LedgerRevertService,
    LedgerContactsBalanceStorage,
    LedegrAccountsStorage,
  ],
  exports: [
    LedgerStorageService,
    LedgerEntriesStorageService,
    LedgerRevertService,
    LedegrAccountsStorage,
  ],
})
export class LedgerModule {}
