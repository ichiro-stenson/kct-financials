import { Inject, Injectable, Module } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { IAuthSignedUpEventPayload } from '@/modules/Auth/Auth.interfaces';
import { UserTenant } from '@/modules/System/models/UserTenant.model';

/**
 * OSS stub: create the user_tenants record on signup so the user can
 * sign in immediately after registering (the EE version also does this
 * via CreateUserTenantOnSignupSubscriber).
 */
@Injectable()
export class CreateUserTenantOnSignupSubscriber {
  constructor(
    @Inject(UserTenant.name)
    private readonly userTenantModel: typeof UserTenant,
  ) {}

  @OnEvent(events.auth.signUp)
  async handleSignUp({
    user,
    tenant,
  }: IAuthSignedUpEventPayload): Promise<void> {
    await this.userTenantModel.query().insert({
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    });
  }
}

/** Stub: EE Workspaces module; OSS build only needs the signup subscriber. */
@Module({
  providers: [CreateUserTenantOnSignupSubscriber],
})
export class WorkspacesModule {}
