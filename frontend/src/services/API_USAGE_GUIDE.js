/**
 * API SERVICE USAGE GUIDE
 * 
 * This file demonstrates how to use the centralized API services in React components
 */

// ============ IMPORT EXAMPLES ============

// Option 1: Import specific services
import authService from '@/services/auth.service';
import leaveService from '@/services/leave.service';

// Option 2: Import from index (recommended for multiple services)
import { authService, leaveService, employeeService } from '@/services';

// ============ USAGE IN COMPONENTS ============

/**
 * Example 1: Login Component
 */
export const LoginExample = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Call your service method - clean and simple!
      const response = await authService.login(email, password);
      
      // Store token
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      // Error is automatically formatted by the interceptor
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

/**
 * Example 2: Forgot Password Component
 */
export const ForgotPasswordExample = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleForgotPassword = async () => {
    try {
      // One-liner API call thanks to centralized service
      await authService.forgotPassword(email);
      
      setMessage('Check your email for password reset link');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div>
      <input 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        placeholder="Enter your email"
      />
      <button onClick={handleForgotPassword}>Send Reset Link</button>
      {message && <div>{message}</div>}
    </div>
  );
};

/**
 * Example 3: Leave Request Form Component
 */
export const LeaveRequestExample = () => {
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      // API call without repeating /api/v1/leaves
      const response = await leaveService.createLeaveRequest(formData);
      
      alert('Leave request submitted successfully!');
      setFormData({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.leaveTypeId}
        onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
        placeholder="Leave Type ID"
      />
      <input
        type="date"
        value={formData.startDate}
        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
      />
      <input
        type="date"
        value={formData.endDate}
        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
      />
      <textarea
        value={formData.reason}
        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
        placeholder="Reason for leave"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Leave Request'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
};

/**
 * Example 4: Using with React Query (TanStack Query)
 * Already installed in this project
 */
import { useQuery, useMutation } from '@tanstack/react-query';

export const LeaveRequestsListWithQuery = () => {
  // Fetch leave requests
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaveRequests'],
    queryFn: () => leaveService.getLeaveRequests(),
  });

  // Mutation for creating leave request
  const createMutation = useMutation({
    mutationFn: (newLeaveData) => leaveService.createLeaveRequest(newLeaveData),
    onSuccess: () => {
      // Refetch the list after successful creation
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Your Leave Requests</h2>
      {data?.data?.map((leave) => (
        <div key={leave.id}>
          <p>{leave.reason}</p>
          <p>From {leave.startDate} to {leave.endDate}</p>
        </div>
      ))}
    </div>
  );
};

/**
 * Example 5: Handling 401 Unauthorized (Auto Redirect)
 * 
 * When any request returns 401:
 * - Token is cleared from localStorage
 * - User is redirected to /login automatically
 * - You don't need to handle this manually in every component!
 */

/**
 * Example 6: Handling Rate Limiting
 * 
 * If you hit rate limit (429):
 * - Error message includes retry time: "Too many requests. Please try again in 599 seconds."
 * - The error is caught in the catch block
 * - You can show a user-friendly message
 */
export const RateLimitExample = () => {
  const handleRequest = async () => {
    try {
      await authService.forgotPassword('test@example.com');
    } catch (err) {
      // err.message will be something like:
      // "Too many requests. Please try again in 599 seconds."
      console.error(err.message);
    }
  };
};

// ============ KEY BENEFITS ============
/**
 * 
 * 1. DRY (Don't Repeat Yourself):
 *    - No more typing /api/v1/auth/login in every component
 *    - Just call authService.login()
 * 
 * 2. Centralized Configuration:
 *    - Change API URL in one place (.env)
 *    - All requests automatically use it
 * 
 * 3. Automatic JWT Token Management:
 *    - Every request automatically includes the token from localStorage
 *    - No need to manually set Authorization headers
 * 
 * 4. Global Error Handling:
 *    - 401 errors auto-redirect to login
 *    - Rate limits show friendly error messages
 *    - Server errors handled consistently
 * 
 * 5. Easy to Test:
 *    - Services are pure functions
 *    - Can mock services in tests
 * 
 * 6. Scalable:
 *    - Add new services for new features
 *    - All follow the same pattern
 *    - New developers understand the structure easily
 */

// ============ ENVIRONMENT VARIABLES ============
/**
 * 
 * .env file:
 * VITE_API_URL=http://localhost:3322
 * 
 * In code, access via:
 * import.meta.env.VITE_API_URL
 * 
 * For development and production, just change the .env file
 * No code changes needed!
 */
