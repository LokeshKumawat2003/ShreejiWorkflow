export type UserRole = 'organization' | 'admin';

export type User = {
  id?: string;
  _id?: string;
  name?: string;
  organizationName?: string;
  phone?: string;
  address?: string;
  about?: string;
  website?: string;
  industry?: string;
  email: string;
  role: UserRole;
  status?: string;
  createdAt?: string;
  department?: string;
  avatarUrl?: string;
};

export type EmployeeStatus = 'active' | 'disabled';

export type Employee = {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  phone: string;
  address: string;
  dailySalary: number;
  currency: string;
  bankName: string;
  bankBranch: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankRoutingCode: string;
  status: EmployeeStatus;
  createdAt?: string;
};
