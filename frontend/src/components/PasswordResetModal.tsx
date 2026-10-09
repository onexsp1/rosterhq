import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { baseStyles } from "../theme/sharedStyles";
import { BASE_URL } from "../constants/api";

interface PasswordResetModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
}

type Step = "email" | "code" | "new-password" | "success";

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  visible,
  onClose,
  initialEmail = "",
}) => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const resetState = () => {
    setStep("email");
    setEmail(initialEmail);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setErrorMsg("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleRequestCode = async () => {
    if (!email) {
      setErrorMsg("Please enter your email.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg("Please enter a valid email.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // We always navigate forward to protect user privacy (no email enumeration)
      if (res.ok) {
        setStep("code");
      } else {
        const data = await res.json();
        if (Array.isArray(data.detail)) {
          setErrorMsg(data.detail[0]?.msg || "Invalid format.");
        } else {
          setErrorMsg(data.detail || "Something went wrong.");
        }
      }
    } catch (e) {
      setErrorMsg("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setErrorMsg("Please enter the 6-digit code.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) {
        setStep("new-password");
      } else {
        const data = await res.json();
        if (Array.isArray(data.detail)) {
          setErrorMsg(data.detail[0]?.msg || "Invalid format.");
        } else {
          setErrorMsg(data.detail || "Invalid code.");
        }
      }
    } catch (e) {
      setErrorMsg("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });
      if (res.ok) {
        setStep("success");
      } else {
        const data = await res.json();
        if (Array.isArray(data.detail)) {
          setErrorMsg(data.detail[0]?.msg || "Invalid format.");
        } else {
          setErrorMsg(data.detail || "Could not reset password.");
        }
      }
    } catch (e) {
      setErrorMsg("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === "email" && "Reset Password"}
              {step === "code" && "Verification"}
              {step === "new-password" && "New Password"}
              {step === "success" && "Success!"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {errorMsg ? <Text style={styles.errorMessage}>{errorMsg}</Text> : null}

          {step === "email" && (
            <>
              <Text style={styles.instructions}>
                Enter the email address associated with your account.
              </Text>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleRequestCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === "code" && (
            <>
              <Text style={styles.instructions}>
                Check your email. We've sent a 6-digit verification code to <Text style={{fontWeight: 'bold', color: '#FFF'}}>{email}</Text>.
              </Text>
              <Text style={styles.inputLabel}>6-DIGIT CODE</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={colors.textSubtle}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                autoFocus
              />
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>Verify Code</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === "new-password" && (
            <>
              <Text style={styles.inputLabel}>NEW PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.textSubtle}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Must match password"
                placeholderTextColor={colors.textSubtle}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === "success" && (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={80} color={colors.teal} />
              <Text style={styles.successText}>Password Updated!</Text>
              <Text style={styles.successSubtext}>
                Your password has been successfully reset. You can now log in with your new credentials.
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleClose}
              >
                <Text style={styles.actionBtnText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  ...baseStyles,
  instructions: {
    color: colors.textSubtle,
    fontSize: 15,
    marginBottom: 15,
    lineHeight: 22,
  },
  actionBtn: {
    ...baseStyles.submitBtn,
    marginTop: 25,
  },
  actionBtnText: {
    ...baseStyles.submitBtnText,
  },
  errorMessage: {
    ...baseStyles.errorText,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    overflow: "hidden"
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 15,
  },
  successSubtext: {
    color: colors.textSubtle,
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 22,
  }
});
