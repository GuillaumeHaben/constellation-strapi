export default () => ({
    "users-permissions": {
        config: {
            register: {
                allowedFields: [
                    "firstName",
                    "lastName",
                    "slug",
                    "birthday",
                    "country",
                    "esaSite",
                    "address",
                    "phoneNumber",
                    "instagram",
                    "linkedin",
                    "facebook",
                    "github",
                    "twitter",
                    "directorate",
                    "position",
                    // "workDomain",
                    "profilePicture"
                ],
            },
        },
    },
    email: {
        config: {
            provider: 'nodemailer',
            providerOptions: {
                host: process.env.SMTP_HOST || 'localhost',
                port: parseInt(process.env.SMTP_PORT || '1025'),
                auth: process.env.SMTP_USER ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                } : false,
                secure: false, // Mailpit usually doesn't use SSL/TLS
                tls: {
                    rejectUnauthorized: false
                }
            },
            settings: {
                defaultFrom: process.env.SMTP_FROM || 'no-reply@esa.int',
                defaultReplyTo: process.env.SMTP_REPLY_TO || 'no-reply@esa.int',
            },
        },
    },
});
