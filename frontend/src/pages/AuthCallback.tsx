import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AuthCallback page - Handles Azure AD OAuth redirect
 * After Azure AD authentication, this page:
 * 1. Extracts the authorization code from URL
 * 2. Sends code to backend for token exchange
 * 3. Stores token and redirects to dashboard
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AuthCallback] Processing Azure AD callback...');

        // Backend redirects here with either token or error message.
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const message = params.get('message');

        if (message) {
          const errorMsg = decodeURIComponent(message);
          console.error('[AuthCallback] OAuth error:', errorMsg);
          setError(errorMsg);
          return;
        }

        if (!token) {
          console.error('[AuthCallback] No token in callback URL');
          setError('ไม่พบโทเค็นจากการเข้าสู่ระบบ Microsoft');
          return;
        }

        console.log('[AuthCallback] Token received, storing and redirecting...');
        localStorage.setItem('token', token);

        // Force a full reload so AuthProvider re-initializes from localStorage token.
        window.location.replace('/dashboard');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[AuthCallback] Callback error:', err);
        setError(errorMsg);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-red-500 text-lg font-semibold">เกิดข้อผิดพลาด</div>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">กำลังเข้าสู่ระบบด้วย Azure AD...</p>
          </>
        )}
      </div>
    </div>
  );
}
