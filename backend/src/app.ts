import cors from 'cors';
import express from 'express';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRouter from './routes/auth.routes';
import { healthRouter } from './routes/health.routes';
import profileRouter from './routes/profile.routes';
import nutritionRoutes from "./routes/nutrition.routes";
import stepsRouter from './routes/steps.routes';
import partnerRouter, { publicPartnerRouter } from './routes/partner.routes';
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
import weekPrizeRouter from './routes/weekprize.routes';
import coupleChallengeRouter from './routes/coupleChallenge.routes';
import workoutPhotosRouter from './routes/workoutPhotos.routes';
import sharedMealsRouter from './routes/sharedMeals.routes';
import avatarsRouter from './routes/avatars.routes';
import billingRouter from './routes/billing.routes';
import onboardingRouter from './routes/onboarding.routes';
import chatRouter from './routes/chat.routes';
import widgetsRouter from './routes/widgets.routes';
import homeGoalsRouter from './routes/homeGoals.routes';
import { requirePremiumAccess, requirePremiumForPartnerRoute } from './services/billing';

const app = express();
const premiumRequired = requirePremiumAccess();
const partnerPremiumRequired = requirePremiumForPartnerRoute();

app.use(cors());
// Parse the compressed photo only for this authenticated endpoint.
app.use('/avatars', authMiddleware, express.json({ limit: '1mb' }), avatarsRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(healthRouter);
app.use('/auth', authRouter);
app.use('/billing', billingRouter);
app.use("/nutrition", authMiddleware, premiumRequired, nutritionRoutes);
app.use('/profile', authMiddleware, profileRouter);
app.use('/chat', authMiddleware, chatRouter);
app.use('/activity', authMiddleware, premiumRequired, stepsRouter);
app.use('/partner', publicPartnerRouter);
app.use('/partner', authMiddleware, partnerPremiumRequired, partnerRouter);
app.use('/plan', authMiddleware, planRouter);
app.use('/summary', authMiddleware, premiumRequired, summaryRouter);
app.use('/points', authMiddleware, premiumRequired, pointsRouter);
app.use('/marketplace', authMiddleware, premiumRequired, marketplaceRouter);
app.use('/quests', authMiddleware, premiumRequired, questsRouter);
app.use('/weight', authMiddleware, premiumRequired, weightRouter);
app.use('/hydration', authMiddleware, premiumRequired, hydrationRouter);
app.use('/runtogether', authMiddleware, premiumRequired, runtogetherRouter);
app.use('/training-plan', authMiddleware, premiumRequired, trainingPlanRouter);
app.use('/wager', authMiddleware, premiumRequired, wagerRouter);
app.use('/weekprize', authMiddleware, premiumRequired, weekPrizeRouter);
app.use('/home-goals', authMiddleware, premiumRequired, homeGoalsRouter);
app.use('/couple-challenges', authMiddleware, premiumRequired, coupleChallengeRouter);
app.use('/workout-photos', authMiddleware, premiumRequired, workoutPhotosRouter);
app.use('/shared-meals', authMiddleware, premiumRequired, sharedMealsRouter);
// Authenticated by the widget's own feed token instead of a user session.
app.use('/widgets', widgetsRouter);
app.use('/onboarding', authMiddleware, onboardingRouter);


app.use(notFoundHandler);
app.use(errorHandler);

export default app;
