import { Router } from "express";
import TwitterController from "../controllers/twitter";

const twitterRoutes = Router();

twitterRoutes.get("/usernames", TwitterController.usernames);

export { twitterRoutes };
