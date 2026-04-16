import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import servicesRouter from "./services";
import jobsRouter from "./jobs";
import marketplaceRouter from "./marketplace";
import messagesRouter from "./messages";
import reviewsRouter from "./reviews";
import notificationsRouter from "./notifications";
import emergencyRouter from "./emergency";
import paymentsRouter from "./payments";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/categories", categoriesRouter);
router.use("/services", servicesRouter);
router.use("/jobs", jobsRouter);
router.use("/marketplace", marketplaceRouter);
router.use("/conversations", messagesRouter);
router.use("/reviews", reviewsRouter);
router.use("/notifications", notificationsRouter);
router.use("/emergency", emergencyRouter);
router.use("/payments", paymentsRouter);
router.use("/admin", adminRouter);

export default router;
