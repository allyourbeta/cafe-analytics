# Vivonet (Infor Atrium) API Reference

Last updated: 2026-03-26

This documents the Vivonet REST API used by our cafe analytics ingestion
pipeline. This knowledge was hard-won through trial and error on Feb 19, 2026
(see "Auth Discovery" below) — please keep it current.

## Authentication

**Header:** `X-API-Key: <see below>`

**The API key is regularly rotated.** The current key lives in this
SharePoint document (managed by Luis Escamilla):
https://ihouseberkeley-my.sharepoint.com/:w:/g/personal/luisescamilla_ihouseberkeley_org/IQAwOCeyNfxpS4OKJSVLr4NNAYmzEgCo5fnfHrizqm_QnXA

When the key changes, update `database/vivonet_service.py` (the `API_KEY`
variable near the top of the file).

This is the ONLY header format that works. We discovered this by trying
every common pattern until one returned a 200.

What DOES NOT work (don't waste time retrying these):
- `api-key: ...` → 497
- `Authorization: Bearer ...` → 497
- `Authorization: ...` → 497
- `?apiKey=...` as query parameter → 497

The 497 status code is non-standard (not a normal 401/403). It appears to
be Vivonet's custom "bad auth" response. There is no response body when
auth fails — just an empty 497.

## Endpoints

### Get Orders

```
GET https://api.vivonet.com/v1/companies/83832/stores/{storeId}/data/orders
    ?startTime=YYYYMMDD&endTime=YYYYMMDD
```

**Store IDs:**
- Cafe: `192328`
- Events: `196842`

**Date format:** `YYYYMMDD` only. Intra-day time filtering (e.g.,
`20260219T1500`) returns empty results — you must pull full days and
filter locally.

**Example:**
```bash
curl -s "https://api.vivonet.com/v1/companies/83832/stores/192328/data/orders?startTime=20260325&endTime=20260326" \
  -H "X-API-Key: <YOUR_KEY_HERE>"
```

## Response Format

Returns a JSON array of order objects. Each order contains one or more
"checks," each check contains line items, charges (tax), discounts,
and payments.

### Timestamps

**All timestamps are in UTC.** Pacific time is UTC-8 (standard) or
UTC-7 (daylight saving). This means a 5:00 AM UTC timestamp is actually
9:00 PM the previous day in Pacific time. The ingestion script handles
this conversion automatically.

### Order Structure (simplified)

```json
{
  "orderId": 15409,
  "closedTimestamp": "2026-02-17 07:33:11",    ← UTC
  "createdTimestamp": "2026-02-17 07:32:42",   ← UTC
  "positionId": 7898454,                        ← register/terminal ID
  "orderPlacedBy": "Halo",
  "checks": [
    {
      "charges": [
        { "amount": 0.95, "name": "State Tax" }
      ],
      "discounts": [
        { "discountName": "$1 Coffee Happy Hour: Medium Hot Drinks",
          "discountType": "amount", "value": -1 }
      ],
      "payments": [
        { "amount": -10.20, "tenderId": 10017,
          "paymentMethod": { "paymentMethodDescription": "VISA ****3705" } }
      ],
      "orderLineItems": [
        {
          "orderLineItemId": 65437,     ← globally unique, used for idempotency
          "productId": 17326716,
          "productName": "Raspberry Beignets",
          "quantity": 1,
          "price": 3.00,
          "modifiers": [
            {
              "orderLineItemId": 65439,
              "productName": ">Whole Milk",  ← ">" prefix = free customization
              "price": 0
            }
          ]
        }
      ]
    }
  ]
}
```

### Modifiers (Two Types)

1. **">" prefix** (e.g., ">Whole Milk", ">No Room", ">Cup Needs a Sleeve")
   Zero-price customizations. Our pipeline skips these entirely.

2. **"..." prefix** (e.g., "...Chive Cream Cheese" @ $1.75, "...$Extra Sweet" @ $0.50)
   Priced add-ons. Our pipeline treats these as separate revenue items.

### Voids / Refunds

Confirmed from live data (order #16547, 2026-02-19): Voids appear as
**negative-quantity line items** in a **separate order**. The voided
order has `numberOfGuests: 0` and a positive payment amount (refund).

```json
{
  "orderId": 16547,
  "numberOfGuests": 0,
  "checks": [{
    "payments": [{ "amount": 7.44 }],
    "orderLineItems": [
      { "productName": "Lrg Latte",  "quantity": -1, "price": 6.25 },
      { "productName": "Oat Milk",   "quantity": -1, "price": 0.50 }
    ]
  }]
}
```

Our pipeline flags these in `database/vivonet_review.log` and does NOT
insert them as transactions. If we later need to track refunds explicitly,
we'd add a separate `refunds` table.

**Open question:** Are there other void formats we haven't seen yet
(e.g., order-level cancellations, modified original orders)? This is a
question for the Infor/database team.

### Discounts

Discounts appear at the check level, not the line item level. Example:
"$1 Coffee Happy Hour: Medium Hot Drinks" with value -1. Currently our
pipeline records the full menu price, not the discounted amount.

### Position IDs

The `positionId` field identifies the terminal/register. We've seen 16
unique values across sample data. These are stored in the `register_num`
column of our transactions table. They do NOT map 1:1 to the old TouchNet
register numbers (1, 3, 4).

## Rate Limits / Pagination

Unknown. We have not observed rate limiting or pagination in responses
up to ~400 orders per day. The backfill script uses 7-day chunks with
a 1-second delay between calls as a precaution.

## Developer Portal

Vivonet has a developer portal at `developer.vivonet.com` (behind login).
As of Feb 2026, we do not have access. Our contact Chivann provided the
API key and endpoint URLs directly. Full API documentation would help
answer remaining questions about void handling, rate limits, and available
endpoints.
