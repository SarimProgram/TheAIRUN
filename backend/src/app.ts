import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRouter from './routes/auth.routes';
import { healthRouter } from './routes/health.routes';
import profileRouter from './routes/profile.routes';
import nutritionRoutes from "./routes/nutrition.routes";
import stepsRouter from './routes/steps.routes';
import partnerRouter from './routes/partner.routes';
import planRouter from './routes/plan.routes';
import summaryRouter from './routes/summary.routes';
import pointsRouter from './routes/points.routes';
import marketplaceRouter from './routes/marketplace.routes';
import questsRouter from './routes/quests.routes';
import weightRouter from './routes/weight.routes';
import hydrationRouter from './routes/hydration.routes';
import runtogetherRouter from './routes/runtogether.routes';
import trainingPlanRouter from './routes/trainingPlan.routes';
import wagerRouter from './routes/wager.routes';
import billingRouter from './routes/billing.routes';
import onboardingRouter from './routes/onboarding.routes';
import { requirePremiumAccess } from './services/billing';

const app = express();
const premiumRequired = requirePremiumAccess();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(healthRouter);
app.use('/auth', authRouter);
app.use('/billing', billingRouter);
app.use("/nutrition", authMiddleware, premiumRequired, nutritionRoutes);
app.use('/profile', authMiddleware, profileRouter);
app.use('/activity', authMiddleware, premiumRequired, stepsRouter);
app.use('/partner', authMiddleware, premiumRequired, partnerRouter);
app.use('/plan', authMiddleware, premiumRequired, planRouter);
app.use('/summary', authMiddleware, premiumRequired, summaryRouter);
app.use('/points', authMiddleware, premiumRequired, pointsRouter);
app.use('/marketplace', authMiddleware, premiumRequired, marketplaceRouter);
app.use('/quests', authMiddleware, premiumRequired, questsRouter);
app.use('/weight', authMiddleware, premiumRequired, weightRouter);
app.use('/hydration', authMiddleware, premiumRequired, hydrationRouter);
app.use('/runtogether', authMiddleware, premiumRequired, runtogetherRouter);
app.use('/training-plan', authMiddleware, premiumRequired, trainingPlanRouter);
app.use('/wager', authMiddleware, premiumRequired, wagerRouter);
app.use('/onboarding', authMiddleware, premiumRequired, onboardingRouter);


app.use(notFoundHandler);
app.use(errorHandler);

export default app;
