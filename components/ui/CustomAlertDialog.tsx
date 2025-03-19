"use client";

import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CustomAlertProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'info' | 'warning';
}

export function CustomAlert({ isOpen, title, message, onClose, type = 'info' }: CustomAlertProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={
            type === 'success' ? 'text-green-600' :
            type === 'error' ? 'text-red-600' :
            type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
          }>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

let showAlertFn: ((options: { title: string, description: string, type?: 'success' | 'error' | 'info' | 'warning' }) => Promise<void>) | null = null;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: "",
    message: "",
    type: 'info',
    onClose: () => {},
  });

  useEffect(() => {
    showAlertFn = (options: { title: string, description: string, type?: 'success' | 'error' | 'info' | 'warning' }) => {
      return new Promise<void>((resolve) => {
        setAlertState({
          isOpen: true,
          title: options.title,
          message: options.description,
          type: options.type || 'info',
          onClose: () => {
            setAlertState((prev) => ({ ...prev, isOpen: false }));
            resolve();
          },
        });
      });
    };

    return () => {
      showAlertFn = null;
    };
  }, []);

  return (
    <>
      {children}
      <CustomAlert
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={alertState.onClose}
      />
    </>
  );
}

export function showAlert(options: { title: string, description: string, type?: 'success' | 'error' | 'info' | 'warning' }): Promise<void>;
export function showAlert(title: string, message: string): Promise<void>;
export function showAlert(
  titleOrOptions: string | { title: string, description: string, type?: 'success' | 'error' | 'info' | 'warning' },
  message?: string
): Promise<void> {
  if (!showAlertFn) {
    console.error("AlertProvider not initialized");
    return Promise.resolve();
  }
  
  if (typeof titleOrOptions === 'string' && message) {
    return showAlertFn({ title: titleOrOptions, description: message });
  } else if (typeof titleOrOptions === 'object') {
    return showAlertFn(titleOrOptions);
  }
  
  return Promise.resolve();
}
