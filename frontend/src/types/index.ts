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

export type OrganizationLocation = {
  id: string;
  workName: string;
  opNumber: string;
  name: string;
  address: string;
  designation: string;
  status: 'active' | 'disabled';
  createdAt: string;
};

export type MasterDataType = 'designation' | 'employmentType' | 'skillCategory';

export type MasterDataItem = {
  id: string;
  type: MasterDataType;
  name: string;
  code: string;
  status: 'active' | 'disabled';
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeStatus = 'active' | 'disabled';

export type Employee = {
  id: string;
  organizationId: string;
  locationId?: string;
  locationAssignedAt?: string | null;
  organizationName: string;
  name: string;
  email: string;
  dateOfBirth: string;
  parentName: string;
  aadhaarNumber: string;
  aadhaarConsent: boolean;
  establishmentLin: string;
  uan: string;
  esicNumber: string;
  designation: string;
  employmentType: string;
  skillCategory: string;
  dateOfJoining: string;
  basicPay: number;
  dearnessAllowance: number;
  otherAllowances: string;
  epfoApplicable: boolean;
  esicApplicable: boolean;
  duties: string;
  maternityBenefits: string;
  otherInformation: string;
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
