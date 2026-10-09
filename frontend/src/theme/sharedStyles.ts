import { colors as defaultColors, ThemeColors } from "./colors";

export const getSharedStyles = (colors: ThemeColors): any => ({
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 30,
    paddingBottom: 50,
  },
  modalHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 20,
  },
  modalTitle: { 
    color: colors.textMain, 
    fontSize: 24, 
    fontWeight: "bold" as const 
  },
  modalSub: {
    color: colors.textSubtle,
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center" as const,
  },

  // Inputs
  labelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 8,
    marginTop: 10,
  },
  inputLabel: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: "bold" as const,
    textTransform: "uppercase" as const,
  },
  input: {
    backgroundColor: "rgba(150, 150, 150, 0.1)", // Theme-neutral opacity
    color: colors.textMain,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 5,
  },
  inputErrorBorder: { 
    borderWidth: 1, 
    borderColor: colors.coral 
  },
  errorText: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },

  // Buttons
  submitBtn: {
    backgroundColor: colors.teal,
    padding: 18,
    borderRadius: 16,
    alignItems: "center" as const,
    width: "100%" as const,
  },
  submitBtnText: { 
    color: "#FFF", 
    fontSize: 18, 
    fontWeight: "bold" as const 
  },

  // UI Utilities
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.coral,
    marginLeft: 6,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export const baseStyles: any = getSharedStyles(defaultColors);
