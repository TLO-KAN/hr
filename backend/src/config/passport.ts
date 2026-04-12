/**
 * Passport OAuth Strategy Configuration
 * Azure AD Authentication
 */

import passport from 'passport';
import { Strategy as OAuthStrategy } from 'passport-oauth2';
import axios from 'axios';

interface AADProfile {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

/**
 * Configure Passport Azure AD Strategy
 */
export function configurePassport(): void {
  const clientID = process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_CLIENT_ID || '';
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET || '';
  const tenantID = process.env.AZURE_AD_TENANT_ID || process.env.AZURE_TENANT_ID || 'common';
  const redirectURL = process.env.AZURE_AD_REDIRECT_URI || 'http://localhost:3322/api/v1/auth/microsoft/callback';

  if (!clientID || !clientSecret) {
    console.warn('⚠️  Azure AD credentials not configured');
    return;
  }

  const authorizationURL = `https://login.microsoftonline.com/${tenantID}/oauth2/v2.0/authorize`;
  const tokenURL = `https://login.microsoftonline.com/${tenantID}/oauth2/v2.0/token`;

  passport.use(
    'azure-ad',
    new OAuthStrategy(
      {
        clientID,
        clientSecret,
        authorizationURL,
        tokenURL,
        callbackURL: redirectURL,
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          // Fetch user profile from Microsoft Graph API
          const graphResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          const userProfile: AADProfile = {
            id: graphResponse.data.id,
            displayName: graphResponse.data.displayName,
            mail: graphResponse.data.mail || graphResponse.data.userPrincipalName,
            userPrincipalName: graphResponse.data.userPrincipalName,
          };

          return done(null, userProfile);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, (user as any).id);
  });

  passport.deserializeUser((id, done) => {
    // In production, fetch user from database
    done(null, { id });
  });

  console.log('✅ Passport Azure AD strategy configured');
}

export default passport;
