# Work Plan

Order is chosen to remove immediate booking friction, update the scheduling logic/UX, and then layer on admin tooling. Items stay unchecked until you confirm testing is done; we will tackle them one at a time.

- [x] Fix "Book another appointment" button after a successful booking so it routes back to the services page for a fresh selection.
- [x] Change default booking slots to 40 minutes with adaptive durations: Kids Cut, Hair Line Up, and Beard Trim at 20 minutes (freeing the remaining half-slot); Deluxe at 60 minutes (consuming 1.5 slots) while exposing the leftover half-slot for other services.
- [x] Update booking flow wording to reflect 40-minute spacing, adjust join-queue guidance to suggest trying alternative services when only 20-minute blocks remain, and label Kids Cut/Hair Line Up/Beard Trim as 20 minutes.
- [x] Add an admin-calendar visualizer that clearly shows each day's bookings with client, service, and time.
- [x] Build an admin page to CRUD social icons/links with a dropdown of the top social platforms (e.g., Snapchat, LinkedIn) and have updates propagate wherever socials render.
- [x] Build an admin page to manage the About page content, including CRUD for the "Meet our barbers" section with local image uploads.
