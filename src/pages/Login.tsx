import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PackagePlus, Copy } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { handleFirebaseError } from '../lib/firebase-errors';

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowDomainHelp(false);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back!');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Create user profile
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email,
          role: 'staff', // Default to staff
          createdAt: new Date(),
        });
        toast.success('Account created successfully!');
      }
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed') {
        setShowDomainHelp(true);
      }
      handleFirebaseError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center mb-4">
            <PackagePlus className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white">ParcelTracker</h1>
          <p className="text-slate-400 mt-2">Professional Transport Management</p>
        </div>
        
        <div className="p-8">
          {showDomainHelp && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                ⚠️ Connection Issue Detected
              </h3>
              <p className="mb-2">
                This error usually happens when the current domain is not authorized in Firebase.
              </p>
              <p className="mb-2">
                <strong>Action Required:</strong> Go to Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains and add:
              </p>
              <div className="flex items-center gap-2 mb-2">
                <code className="block bg-amber-100 p-2 rounded font-mono text-xs select-all flex-1 break-all">
                  {window.location.hostname}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.hostname);
                    toast.success('Domain copied!');
                  }}
                  className="p-2 bg-amber-200 hover:bg-amber-300 rounded text-amber-800 transition-colors shrink-0"
                  title="Copy Domain"
                >
                  <Copy size={14} />
                </button>
              </div>
              <p className="text-xs text-amber-600">
                After adding, wait 1-2 minutes and try again.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            
            <Button
              type="submit"
              className="w-full"
              isLoading={loading}
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
