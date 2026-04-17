import express from "express";
import socialRouter from "./social.js";
import websiteRouter from "./website.js";
import emailRouter from "./email.js";
import followUpsRouter from "./followUps.js";
import contactsRouter from "./contacts.js";
import statusRouter from "./status.js";
import crudRouter from "./crud.js";

/**
 * Mount order matters: routers with specific paths (no `:id`) must register
 * before crudRouter, which owns the catch-all `GET /:id` / `DELETE /:id`.
 */
const router = express.Router();
router.use(socialRouter);
router.use(websiteRouter);
router.use(emailRouter);
router.use(followUpsRouter);
router.use(contactsRouter);
router.use(statusRouter);
router.use(crudRouter);

export default router;
