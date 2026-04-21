import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'weyou_customer_token';
const BRANCH_KEY = 'weyou_customer_branch_id';

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, BRANCH_KEY]);
}

export async function getStoredBranchId(): Promise<string | null> {
  return AsyncStorage.getItem(BRANCH_KEY);
}

export async function setStoredBranchId(branchId: string): Promise<void> {
  await AsyncStorage.setItem(BRANCH_KEY, branchId);
}
