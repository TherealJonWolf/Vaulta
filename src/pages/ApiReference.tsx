import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Code, Lock, Key, FileText, Shield, AlertTriangle } from "lucide-react";

const apiEndpoints = [
  {
    method: "POST",
    path: "/api/documents/upload",
    description: "Upload and encrypt a document",
    auth: "Bearer Token + MFA",
    controls: ["SC-8", "SC-13", "SC-28"]
  },
  {
    method: "GET",
    path: "/api/documents/{id}",
    description: "Retrieve and decrypt a document",
    auth: "Bearer Token",
    controls: ["AC-3", "AU-2", "SC-13"]
  },
  {
    method: "DELETE",
    path: "/api/documents/{id}",
    description: "Securely delete a document",
    auth: "Bearer Token + MFA",
    controls: ["MP-6", "AU-2", "AC-6"]
  },
  {
    method: "GET",
    path: "/api/audit/logs",
    description: "Retrieve security audit logs",
    auth: "Bearer Token (Admin)",
    controls: ["AU-3", "AU-6", "AU-9"]
  },
  {
    method: "POST",
    path: "/api/auth/mfa/enroll",
    description: "Enroll in multi-factor authentication",
    auth: "Bearer Token",
    controls: ["IA-2", "IA-5"]
  },
  {
    method: "POST",
    path: "/api/auth/mfa/verify",
    description: "Verify MFA token",
    auth: "Bearer Token + TOTP",
    controls: ["IA-2", "IA-5", "AU-2"]
  }
];

export default function ApiReference() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold text-primary mb-4">
              API REFERENCE
            </h1>
            <p className="text-muted-foreground font-rajdhani text-lg mb-12 max-w-2xl">
              Secure API endpoints with NIST 800-53 control mappings for enterprise integration.
            </p>

            {/* Security Notice */}
            <section className="mb-12">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">Security Notice</h3>
                  <p className="text-muted-foreground font-rajdhani">
                    All API requests must be authenticated and transmitted over TLS 1.3 (SC-8). 
                    Rate limiting and request logging are enforced per AU-2 and SI-4 controls.
                    API keys should be rotated every 90 days per IA-5 requirements.
                  </p>
                </div>
              </div>
            </section>

            {/* Authentication */}
            <section className="mb-12">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider flex items-center gap-3">
                <Key className="w-6 h-6 text-primary" />
                AUTHENTICATION
              </h2>
              <div className="bg-card/50 border border-border rounded-lg p-6">
                <p className="text-muted-foreground font-rajdhani mb-4">
                  Vaulta uses Bearer token authentication with optional MFA verification for sensitive operations.
                  All tokens are JWT-based with RS256 signing.
                </p>
                <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <code className="text-primary">
                    Authorization: Bearer {"<your_access_token>"}
                  </code>
                  <br />
                  <code className="text-muted-foreground">
                    X-MFA-Token: {"<totp_code>"} // Required for sensitive operations
                  </code>
                </div>
              </div>
            </section>

            {/* Endpoints */}
            <section className="mb-12">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider flex items-center gap-3">
                <Code className="w-6 h-6 text-primary" />
                ENDPOINTS
              </h2>
              <div className="space-y-4">
                {apiEndpoints.map((endpoint, index) => (
                  <motion.div
                    key={`${endpoint.method}-${endpoint.path}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="bg-card/50 border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className={`font-mono text-sm px-2 py-1 rounded ${
                        endpoint.method === 'GET' ? 'bg-secure-green/20 text-secure-green' :
                        endpoint.method === 'POST' ? 'bg-primary/20 text-primary' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="font-mono text-foreground">{endpoint.path}</code>
                    </div>
                    <p className="text-muted-foreground font-rajdhani mb-3">{endpoint.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">{endpoint.auth}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <div className="flex gap-1">
                          {endpoint.controls.map((control) => (
                            <span key={control} className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">
                              {control}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Rate Limiting */}
            <section>
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary" />
                RATE LIMITING & AUDIT
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card/50 border border-border rounded-lg p-6">
                  <h3 className="font-display text-lg font-bold text-foreground mb-3">Rate Limits (SI-4)</h3>
                  <ul className="space-y-2 text-muted-foreground font-rajdhani">
                    <li>• 100 requests/minute per API key</li>
                    <li>• 10 upload requests/minute</li>
                    <li>• 5 MFA attempts per 15 minutes</li>
                    <li>• Automatic lockout after threshold</li>
                  </ul>
                </div>
                <div className="bg-card/50 border border-border rounded-lg p-6">
                  <h3 className="font-display text-lg font-bold text-foreground mb-3">Audit Logging (AU-2)</h3>
                  <ul className="space-y-2 text-muted-foreground font-rajdhani">
                    <li>• All API calls logged with timestamps</li>
                    <li>• IP address and user agent captured</li>
                    <li>• 90-day retention policy</li>
                    <li>• Tamper-evident log storage</li>
                  </ul>
                </div>
              </div>
            </section>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
