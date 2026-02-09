## PHP Mail Configuration (Deployment Reminder)

1. Update PHP configuration to point at a working SMTP relay:
   - Set `SMTP`, `smtp_port`, and `sendmail_from` to `uecampus.com`, `465`, and your noreply address (already in `php.ini`).
   - On Linux, install `msmtp` (or another SMTP wrapper) and update `sendmail_path` (see `php.ini`).
2. Restart PHP-FPM or Apache/httpd after editing `php.ini`.
3. Ensure `.env` on the deployment host has values you control:
   ```
   MAIL_ENABLED=true
   MAIL_FROM_ADDRESS=noreply@uecampus.com
   MAIL_REPLY_TO=support@uecampus.com
   FRONTEND_URL=https://studyportal.uecampus.com
   ```
4. Install/configure `msmtp` using `.msmtprc.example` as a template so authenticated SSL (port 465) is handled before PHP calls `mail()`.
- Store the file at `/etc/msmtprc` or `~/.msmtprc` (chmod 600) and adjust `password` if it ever rotates.


This file is a reminder for whoever deploys the backend so the welcome emails can actually be delivered.
