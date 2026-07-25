import React from "react";

interface Props {
  children: React.ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: any;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: any, info: any) {
    console.error("ErrorBoundary caught error:", error);
    console.error("Component stack:", info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="bg-white border border-red-200 rounded-2xl p-6 text-center"
          dir="rtl"
        >
          <div className="text-red-600 text-lg font-black mb-2">
            ⚠️ حدث خطأ في هذه الصفحة
          </div>
          {this.props.title && (
            <div className="text-sm text-gray-500 mb-3">
              الصفحة: {this.props.title}
            </div>
          )}
          <pre className="text-xs text-red-500 bg-red-50 rounded-xl p-3 overflow-auto text-right whitespace-pre-wrap">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}