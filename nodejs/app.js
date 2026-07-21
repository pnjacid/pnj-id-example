const express = require("express");
const axios = require("axios");
const https = require("https");
const session = require("express-session");

const app = express();

const CAS_SERVER = "https://id.pnj.ac.id/cas";
const SERVICE_URL = "http://localhost:3000";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

app.use(
  session({
    secret: "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }, // 1 jam (session lokal app)
  }),
);

app.get("/", async (req, res) => {
  // sudah punya session → tidak perlu validasi lagi
  if (req.session.user) {
    return res.send(`
      <h1>Hello ${req.session.user}</h1>
      <a href="/logout">Logout</a>
    `);
  }

  const ticket = req.query.ticket;

  if (!ticket) {
    const loginUrl = `${CAS_SERVER}/login?service=${encodeURIComponent(SERVICE_URL)}`;
    return res.redirect(loginUrl);
  }

  try {
    const validateUrl = `${CAS_SERVER}/p3/serviceValidate?service=${encodeURIComponent(SERVICE_URL)}&ticket=${encodeURIComponent(ticket)}`;

    const response = await axios.get(validateUrl, { httpsAgent });
    const data = response.data;

    if (data.includes("<cas:authenticationSuccess>")) {
      // ambil username dari XML (simple parsing)
      const user = data.match(/<cas:user>(.*?)<\/cas:user>/)[1];

      req.session.user = user;

      return res.redirect("/");
    }

    return res.send("SSO FAILED ❌");
  } catch (err) {
    console.error(err.message);
    return res.send("Error validating ticket");
  }
});

app.get("/logout", (req, res) => {
  // hapus session lokal
  req.session.destroy(() => {
    // redirect ke CAS logout
    const logoutUrl = `${CAS_SERVER}/logout?service=${encodeURIComponent(SERVICE_URL)}`;
    res.redirect(logoutUrl);
  });
});

app.listen(3000, () => {
  console.log("Client running at http://localhost:3000");
});
