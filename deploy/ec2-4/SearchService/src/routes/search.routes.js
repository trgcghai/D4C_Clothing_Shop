import express from "express";
import { handleSearch } from "../controllers/search.controller.js";

const router = express.Router();

router.get("/", handleSearch);

export default router;
