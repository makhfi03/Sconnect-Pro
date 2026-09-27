# SportConnect Pro

Plateforme de gestion des inscriptions sportives municipales construite en **Node.js natif** (sans framework monolithique) avec **PostgreSQL**.

## Arborescence du projet

```text
sportconnect-pro/
|-- database/
|   |-- schema.sql
|   |-- seeds.sql
|   `-- queries_analytics.sql
|-- public/
|   |-- css/
|   |   |-- style.css
|   |   `-- print.css
|   |-- js/
|   |   |-- dynamic-pricing.js
|   |   `-- client-validation.js
|   `-- images/
|-- src/
|   |-- config/
|   |   `-- db.js
|   |-- core/
|   |   |-- router.js
|   |   `-- renderer.js
|   |-- services/
|   |   |-- pricingService.js
|   |   |-- scheduleService.js
|   |   |-- eligibilityService.js
|   |   `-- waitingListService.js
|   |-- controllers/
|   |   |-- homeController.js
|   |   |-- facilityController.js
|   |   |-- activityController.js
|   |   |-- memberController.js
|   |   `-- registrationController.js
|   `-- utils/
|       `-- helpers.js
|-- views/
|   |-- partials/
|   |   |-- header.ejs
|   |   |-- navbar.ejs
|   |   |-- alerts.ejs
|   |   `-- footer.ejs
|   |-- pages/
|   |   |-- dashboard.ejs
|   |   |-- facilities.ejs
|   |   |-- activities.ejs
|   |   |-- activity-detail.ejs
|   |   |-- activity-form.ejs
|   |   |-- members.ejs
|   |   |-- member-form.ejs
|   |   |-- checkout.ejs
|   |   `-- registrations.ejs
|   `-- error.ejs
|-- .env.example
|-- .gitignore
|-- package.json
`-- server.js
```

## Architecture
src/ 
├── config/db.js # Pool de connexions PostgreSQL 
├── core/ 
│ ├── router.js # Routeur Radix Tree (find-my-way) 
│ ├── bodyParser.js # Parseur HTTP natif (JSON + URL-encoded) 
│ └── renderer.js # Moteur de rendu EJS 
├── controllers/ 
│ ├── homeController.js  
│ ├── facilityController.js # CRUD infrastructures 
│ ├── activityController.js # CRUD activités + collision 
│ ├── memberController.js # CRUD adhérents + catégorie fédérale │ └── registrationController.js # Inscription ACID + devis + annulation 
├── services/ 
│ ├── eligibilityService.js # Âge fédéral + certificat médical │ ├── pricingService.js # Tarification multi-critères + échéancier 
│ ├── scheduleService.js # Collision créneaux + jauge ERP 
│ └── waitingListService.js # File d'attente prioritaire + cascade 
├── utils/helpers.js # Échappement XSS + formatage 
└── server.js # Point d'entrée HTTP natif


## Prérequis

- Node.js >= 18
- PostgreSQL >= 14

## Installation

```bash
git clone https://github.com/makhfi03/Sconnect-Pro.git
cd Sconnect-Pro
npm install
cp .env.example .env