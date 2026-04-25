import type { AppConfig } from "../config/env.js";
import type { AppLogger } from "../observability/logger.js";

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class OAuthTokenProvider {
  private accessToken: string | undefined;
  private expiresAt = 0;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.TAILSCALE_OAUTH_CLIENT_ID &&
        this.config.TAILSCALE_OAUTH_CLIENT_SECRET,
    );
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }

    const clientId = this.config.TAILSCALE_OAUTH_CLIENT_ID;
    const clientSecret = this.config.TAILSCALE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("OAuth credentials are not configured");
    }

    const response = await fetch(
      `${this.config.TAILSCALE_API_BASE_URL}/api/v2/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    );

    if (!response.ok) {
      this.logger.error("OAuth token request failed", {
        status: response.status,
      });
      throw new Error(`OAuth token request failed: HTTP ${response.status}`);
    }

    const token = (await response.json()) as OAuthTokenResponse;
    this.accessToken = token.access_token;
    this.expiresAt = Date.now() + token.expires_in * 1000;
    return token.access_token;
  }
}
