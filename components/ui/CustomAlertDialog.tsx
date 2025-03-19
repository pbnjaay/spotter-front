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
}

export function CustomAlert({ isOpen, title, message, onClose }: CustomAlertProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type AlertState = {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

let showAlertFn: ((title: string, message: string) => Promise<void>) | null = null;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: "",
    message: "",
    onClose: () => {},
  });

  useEffect(() => {
    showAlertFn = (title: string, message: string) => {
      return new Promise<void>((resolve) => {
        setAlertState({
          isOpen: true,
          title,
          message,
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
        onClose={alertState.onClose}
      />
    </>
  );
}

export function showAlert(title: string, message: string): Promise<void> {
  if (!showAlertFn) {
    console.error("AlertProvider not initialized");
    return Promise.resolve();
  }
  return showAlertFn(title, message);
}
