"""
Router: /api/payments

Endpoints:
  POST /api/create-checkout-session — create Stripe checkout session for Pro subscription
  POST /api/webhook — handle Stripe webhook events
"""
from __future__ import annotations

import logging
import os
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

# Stripe configuration — all values required from .env
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

if not STRIPE_SECRET_KEY:
    logger.warning("STRIPE_SECRET_KEY not set — payment endpoints will fail.")
if not STRIPE_PRICE_ID:
    logger.warning("STRIPE_PRICE_ID not set — checkout creation will fail.")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/api", tags=["payments"])


@router.post("/create-checkout-session")
def create_checkout_session(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    """Create a Stripe checkout session for Pro subscription."""
    try:
        # Create or retrieve Stripe customer
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.username,
            )
            current_user.stripe_customer_id = customer.id
            db.commit()

        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=current_user.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": STRIPE_PRICE_ID,
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/dashboard?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/dashboard?canceled=true",
        )

        return {"url": session.url}

    except Exception as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(status_code=400, detail="Failed to create checkout session")


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        logger.error("Webhook error: Invalid payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.error("Webhook error: Invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    logger.info(f"Received Stripe webhook event: {event.type}")

    # Handle the event
    if event.type == "customer.subscription.created":
        subscription = event.data.object
        customer_id = subscription.customer
        logger.info(f"Subscription created for customer: {customer_id}, status: {subscription.status}")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            if subscription.status == "active":
                user.subscription_status = "pro"
                db.commit()
                logger.info(f"User {user.email} (ID: {user.id}) upgraded to Pro via subscription created")
            else:
                logger.info(f"Subscription created but not active for user {user.email}")
        else:
            logger.warning(f"No user found with stripe_customer_id: {customer_id}")

    elif event.type == "customer.subscription.updated":
        subscription = event.data.object
        customer_id = subscription.customer
        logger.info(f"Subscription updated for customer: {customer_id}, status: {subscription.status}")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            if subscription.status == "active":
                user.subscription_status = "pro"
                db.commit()
                logger.info(f"User {user.email} (ID: {user.id}) upgraded to Pro via subscription updated")
            elif subscription.status == "canceled":
                user.subscription_status = "canceled"
                db.commit()
                logger.info(f"User {user.email} (ID: {user.id}) subscription canceled")
            elif subscription.status == "past_due":
                logger.info(f"User {user.email} subscription past due")
            else:
                logger.info(f"User {user.email} subscription status: {subscription.status}")
        else:
            logger.warning(f"No user found with stripe_customer_id: {customer_id}")

    elif event.type == "customer.subscription.deleted":
        subscription = event.data.object
        customer_id = subscription.customer
        logger.info(f"Subscription deleted for customer: {customer_id}")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.subscription_status = "free"
            db.commit()
            logger.info(f"User {user.email} (ID: {user.id}) subscription deleted, set to free")
        else:
            logger.warning(f"No user found with stripe_customer_id: {customer_id}")

    elif event.type == "invoice.payment_succeeded":
        invoice = event.data.object
        customer_id = invoice.customer
        logger.info(f"Invoice payment succeeded for customer: {customer_id}")
        # This might be redundant, but can ensure status is set
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user and user.subscription_status != "pro":
            user.subscription_status = "pro"
            db.commit()
            logger.info(f"User {user.email} (ID: {user.id}) set to Pro via invoice payment succeeded")

    return {"status": "ok"}