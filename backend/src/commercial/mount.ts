import path from 'path';
import type { Express, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { AppConfig } from '../config';
import {
  createEntitlementsRouter,
  EntitlementsSqlite,
  runEntitlementsMigrations,
  EntitlementsRepository,
  EntitlementsService,
  LicenseSigner,
} from '@blokhr/entitlements';
import {
  createBillingRouter,
  BillingService,
  createBillingProvider,
} from '@blokhr/billing';

export interface CommercialServices {
  entitlements: EntitlementsService;
  billing: BillingService;
  close: () => Promise<void>;
}

/**
 * Builds entitlements + billing services (separate SQLite for entitlements).
 * Packages remain separately deployable via each service server entrypoint.
 */
export async function createCommercialServices(
  config: AppConfig,
  logger: Logger,
): Promise<CommercialServices> {
  const entitlementsDbPath =
    config.nodeEnv === 'test' ? ':memory:' : config.entitlementsDbPath;

  const db = await EntitlementsSqlite.create(entitlementsDbPath);
  const migrationsDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'services',
    'entitlements',
    'migrations',
  );
  await runEntitlementsMigrations(db, migrationsDir);

  const entitlements = new EntitlementsService(
    new EntitlementsRepository(db),
    new LicenseSigner(config.licenseSigningSecret),
  );

  const provider = createBillingProvider({
    razorpayKeyId: config.razorpayKeyId,
    razorpayKeySecret: config.razorpayKeySecret,
    razorpayWebhookSecret: config.razorpayWebhookSecret,
  });

  const billing = new BillingService(
    provider,
    {
      applySubscription: async (input) => {
        await entitlements.applySubscription({
          tenantId: input.tenantId,
          plan: input.plan === 'trial' ? 'trial' : input.plan,
          status: input.status,
          seatLimit: input.seatLimit,
          renewsAt: input.renewsAt,
          source: input.source ?? 'razorpay',
        });
      },
    },
    logger,
  );

  logger.info(
    {
      deploymentMode: config.deploymentMode,
      entitlementsDbPath,
      billingProvider: provider.name,
    },
    'Commercial services ready (entitlements + billing)',
  );

  return {
    entitlements,
    billing,
    close: async () => {
      await db.close();
    },
  };
}

/** Mount commercial HTTP routers on the gateway app (before 404 handler). */
export function mountCommercialRouters(
  app: Express,
  config: AppConfig,
  commercial: CommercialServices,
): void {
  const providerName = config.razorpayKeyId ? 'razorpay' : 'mock';
  app.use('/api/entitlements', createEntitlementsRouter(commercial.entitlements));
  app.use('/api/billing', createBillingRouter(commercial.billing));
  app.get('/api/commercial/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      deploymentMode: config.deploymentMode,
      billingProvider: providerName,
    });
  });
}

/** @deprecated use createCommercialServices + mountCommercialRouters */
export async function mountCommercialServices(
  app: Express,
  config: AppConfig,
  logger: Logger,
): Promise<CommercialServices> {
  const commercial = await createCommercialServices(config, logger);
  mountCommercialRouters(app, config, commercial);
  return commercial;
}
