import React, { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary
 * 
 * Catches unhandled errors in components and displays a fallback UI
 * Prevents the entire app from crashing with a white screen
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // You can log error to an error reporting service here
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    // Optionally refresh or navigate to home
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <AlertTriangle className="h-16 w-16 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">เกิดข้อผิดพลาด</h1>
              <p className="text-muted-foreground">
                ขออภัยค่ะ เกิดข้อผิดพลาดในระบบ โปรดลองใหม่อีกครั้ง
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-left max-h-40 overflow-auto">
                <p className="text-xs font-mono text-destructive">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={this.handleReset}
                className="flex-1"
              >
                กลับไปหน้าหลัก
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                รีโหลด
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
