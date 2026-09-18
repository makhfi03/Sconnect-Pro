# SportConnect Pro

Plateforme de gestion sportive et associative.

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
