# Online payment providers: FedaPay and TrésorPay

Research of 2026-09-25, from public pages fetched on that day. Facts are
quoted with their source. Where a point could not be verified from a public
source, the text says so.

## Summary

| Question | FedaPay | TrésorPay (Benin) |
|---|---|---|
| What it is | A private payment aggregator (FedaPay SA) for merchants and platforms | The payment channel of the Treasury (DGTCP) for rights, fees and payments to accounts held at the Treasury |
| Payment means in Benin | MTN, Moov, Celtiis, BMO, Coris Money, Visa and MasterCard [1] | Mobile Money and bank card, according to the Treasury procedure [7] |
| Public developer documentation | Yes: REST API, libraries, sandbox [2][3] | None found |
| Self service sandbox | Yes, sandbox.fedapay.com, test numbers 64000001 and 66000001 [3] | Not found |
| Webhooks with signature | Yes, HMAC SHA-256, header X-FEDAPAY-SIGNATURE [5] | Not verifiable |
| Who can integrate | Any merchant account holder (test, then live after account validation) [2] | Not verifiable; the collecting entity must hold an account at the Treasury [8] |
| Used by Classéo today | Yes, adapter `src/lib/payments/providers/fedapay.ts` | No: an adapter can be added when an integration is opened |

## FedaPay

- **API.** Servers `https://sandbox-api.fedapay.com` and `https://api.fedapay.com`, authentication by `Authorization: Bearer <secret key>`, JSON answers [3]. A test key works only on the sandbox and objects of the two modes are separate [2].
- **Collecting a payment.** Create a transaction (`POST /v1/transactions`: description, integer amount, currency `XOF`, `callback_url`, customer, `custom_metadata`) [4], then ask its payment link (`POST /v1/transactions/{id}/token`, answer `token` and `url`) and redirect the payer to it [4][6]. The payer comes back to `callback_url` with `?id=&status=`, a status the documentation says not to trust: the status must be read from the API [6].
- **Statuses.** `pending` (default, expires after 24 hours), `approved`, `declined`, `canceled`, `refunded`, `transferred`. `declined` and `canceled` are not final: the payer may retry [6].
- **Webhooks.** POST of an event (`transaction.created`, `transaction.approved`, `transaction.declined`, `transaction.canceled`, `transaction.transferred`...), 2xx expected, up to 9 retries with exponential delay, the same event may arrive several times [5]. Each call is signed in `X-FEDAPAY-SIGNATURE` with the secret of the endpoint, different between test and live; the header holds a timestamp against replays [5]. The official Node library shows the exact form: `t=<unix time>,s=<hex>`, where the signature is HMAC SHA-256 of `<t>.<raw body>`, with a default tolerance of 300 seconds (file `src/Webhook.ts` of github.com/fedapay/fedapay-node).
- **Sub-accounts.** A marketplace account can split a transaction between sub-accounts with `sub_accounts_commissions` [9]. This is how each school could receive its own fees on its own FedaPay account.

## TrésorPay (Benin)

What could be observed:

- The Treasury site (DGTCP, tresorbenin.bj) links to a portal "Paiements mobiles | Trésor Public" at paiement.tresorbenin.bj, described in search results as "un seul portail pour tous vos paiements", with payments of wood and water titles, police fees, and "des versements directement sur n'importe quel compte au Trésor Public" [7]. The same site lists an eQuittance portal (equittancetresor.finances.bj) for online payment against a Treasury receipt [8].
- The Treasury procedure published as a PDF reads: go to tresorbenin.bj, open the eQuittance portal, choose "initier un paiement" or "paiement en ligne (mobile/carte bancaire)", fill in the form, choose the mode, validate on the phone, receive the receipt by e-mail; conditions: a phone with an active Mobile Money account, and a valid e-mail address [8].
- The payment portal loads a script from `cdn.tresorpay.bj/checkout.js`, whose options (`public_key` starting with `pk_live` or `pk_sandbox`, `transaction_id`, `custom_metadata`, `sub_accounts_commissions`) and checkout address (`checkout.tresorpay.bj`, `sandbox-checkout.tresorpay.bj`) match FedaPay's Checkout.js. The page `pay.tresorpay.bj` is titled "FedaPay" and loads `cdn.fedapay.com/css/tresorpay.min.css`. A back office login exists at panel.tresorpay.bj.
- Inference, not confirmed by any official statement found: TrésorPay appears to run on FedaPay technology, branded for the Treasury.

What could not be verified:

- Whether a developer API is open to third parties, its documentation, its sandbox and its webhook signature scheme. No public page was found; api.tresorpay.bj and docs.tresorpay.bj did not answer.
- Who may integrate. Presumably public entities collecting to an account at the Treasury (a public school, a commune), through an agreement with the DGTCP; no public text states the conditions.
- How a public school would collect fees through it: the portal lists Treasury accounts as beneficiaries [7], but no procedure for schools was found.

Next step: ask the DGTCP for the integration conditions and the API documentation, with the Ministry as the requesting body.

## How Classéo switches provider

- The payment flow depends only on the interface `PaymentProvider` (`src/lib/payments/providers/types.ts`): create a checkout, read a transaction, verify a webhook.
- `src/lib/payments/providers/index.ts` lists the providers; the option `payments.online` of `src/lib/features.ts` names the active one (`{ provider: "fedapay" }` by default, overridable from the FeatureFlag table without a deployment).
- Adding TrésorPay means a file `tresorpay.ts` implementing the interface and one line in the list. If TrésorPay is indeed built on FedaPay, the adapter may reuse most of `fedapay.ts` with other addresses and keys.
- The webhook route is per provider (`/api/paiements/<provider>/webhook`), and every approved payment goes through the same recording as the cash desk (`src/features/payments/record.ts`): invoice locked, remaining due checked, waterfall over installments, receipt.
- Without keys, the online button is hidden and parents declare their transfers to the school accounts, confirmed by the accountant.

## Sources

1. FedaPay, payment methods: https://docs.fedapay.com/fr/payment-methods
2. FedaPay, authentication and keys: https://docs.fedapay.com/fr/integration-api/authentication
3. FedaPay, sending requests (servers, test numbers): https://docs.fedapay.com/fr/integration-api/sending-requests
4. FedaPay API reference, create a transaction and get its payment link: https://docs.fedapay.com/api-reference/transactions/create and https://docs.fedapay.com/api-reference/transactions/create-token
5. FedaPay, webhooks and events: https://docs.fedapay.com/fr/integration-api/webhooks
6. FedaPay, collects management (redirect, callback, statuses): https://docs.fedapay.com/fr/integration-api/collects-management
7. Trésor public du Bénin, payment portal: https://paiement.tresorbenin.bj/ and DGTCP site: https://tresorbenin.bj/
8. DGTCP, procedure for online payment of rights, fees and charges (PDF): http://www.tresorbenin.bj/documentation/serve/procedure-de-paiement-en-ligne-de-droits-redevances-et-frais-divers-au-tresor-public
9. FedaPay, sub-accounts API: https://docs.fedapay.com/fr/integration-api/sub-accounts-api
