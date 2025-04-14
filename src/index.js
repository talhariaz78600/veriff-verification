const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

// Store uploaded files in memory instead of saving them to disk
const upload = multer({ storage: multer.memoryStorage() });

const API_TOKEN = process.env.API_TOKEN;
const API_SECRET = process.env.API_SECRET;
const API_URL = process.env.API_URL || "https://api.veriff.me/v1";
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 4000;

if (!API_TOKEN || !API_SECRET) {
  throw new Error("Missing Veriff API_TOKEN or API_SECRET in .env");
}

app.use(bodyParser.json());

// 📤 Upload and Verify Image
app.post("/api/upload-veriff-image", upload.single("image"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const imageName = req.file.originalname;

    // Step 1: Start Veriff session
    const session = await startVerificationSession();
    const verificationId = session?.verification?.id;
    console.log("Started session ID:", verificationId);

    // Step 2: Upload image to Veriff
    const imagePayloadObj = {
      image: {
        context: imageName.split(".")[0],
        content: Buffer.from(imageBuffer).toString("base64"),
        timestamp: timestamp(),
      },
    };
    const imagePayloadStr = JSON.stringify(imagePayloadObj);

    const imageHeaders = {
      "x-auth-client": API_TOKEN,
      "x-hmac-signature": generateSignature(imagePayloadStr, API_SECRET),
      "content-type": "application/json",
    };

    await fetch(`${API_URL}/sessions/${verificationId}/media`, {
      method: "POST",
      headers: imageHeaders,
      body: imagePayloadStr,
    });

    // Step 3: Submit verification
    const response = await endVerification(verificationId);
    console.log("End verification response:", response);

    res.json({ status: "submitted", verificationId });
  } catch (error) {
    console.error("Verification failed:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

// ✅ Veriff Webhook (Optional)
app.post("/verification", (req, res) => {
  const signature = req.get("x-hmac-signature");
  const payload = req.body;

  const isValid = isSignatureValid({
    signature,
    secret: API_SECRET,
    payload,
  });

  console.log("🔔 Webhook received:", {
    isValid,
    payload,
  });

  console.log(payload?.data?.verification,"this is verification data")
  if (payload?.data?.verification?.status === "approved") {
    console.log("Verification approved");
  } else if (payload?.data?.verification?.status === "declined") {
    console.log("Verification declined");
  }
  if (payload?.data?.verification?.status === "pending") {
    console.log("Verification pending");
  }
  if (payload?.data?.verification?.status === "submitted") {
    console.log("Verification submitted");
  }
  if (payload?.data?.verification?.status === "error") {
    console.log("Verification error");
  }
  if (payload?.data?.verification?.status === "done") {
    console.log("Verification done");
  }
  if (payload?.data?.verification?.status === "cancelled") {
    console.log("Verification cancelled");
  }
  if (payload?.data?.verification?.status === "timeout") {
    console.log("Verification timeout");
  }
  if (payload?.data?.verification?.status === "started") {
    console.log("Verification started");
  }
  if (payload?.data?.verification?.status === "document") {
    console.log("Verification document");
  }

  res.json({ status: "success" });
});

// 🌐 Start server
app.listen(WEBHOOK_PORT, () => {
  console.log(`✅ Server running on http://localhost:${WEBHOOK_PORT}`);
});

// 🔧 Utility Functions
function timestamp() {
  return new Date().toISOString();
}

function generateSignature(payload, secret) {
  if (payload.constructor !== Buffer) {
    payload = Buffer.from(payload, "utf8");
  }
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

function isSignatureValid({ signature, secret, payload }) {
  const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  const digest = generateSignature(payloadStr, secret);
  return digest === signature.toLowerCase();
}

async function startVerificationSession() {
  const payloadObj = {
    verification: {
      person: {
        firstName: "John",
        lastName: "Doe",
        idNumber: "ABC123",
      },
      document: {
        number: "DOC123456",
        type: "PASSPORT",
        country: "US",
      },
      lang: "en",
      features: ["selfid"],
      timestamp: timestamp(),
    },
  };

  const payloadStr = JSON.stringify(payloadObj);

  const headers = {
    "x-auth-client": API_TOKEN,
    "x-hmac-signature": generateSignature(payloadStr, API_SECRET),
    "content-type": "application/json",
  };

  const response = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers,
    body: payloadStr,
  });

  return await response.json();
}

async function endVerification(verificationId) {
  const payloadObj = {
    verification: {
      frontState: "done",
      status: "submitted",
      timestamp: timestamp(),
    },
  };

  const payloadStr = JSON.stringify(payloadObj);

  const headers = {
    "x-auth-client": API_TOKEN,
    "x-hmac-signature": generateSignature(payloadStr, API_SECRET),
    "content-type": "application/json",
  };

  const response = await fetch(`${API_URL}/sessions/${verificationId}`, {
    method: "PATCH",
    headers,
    body: payloadStr,
  });

  // console.log("response",await response.json())

  return await response.json();
}
