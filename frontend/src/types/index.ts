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
  governmentType?: string;
  area?: string;
  posts?: OrganizationPost[];
  email: string;
  role: UserRole;
  status?: string;
  createdAt?: string;
  department?: string;
  avatarUrl?: string;
};

export type OrganizationPost = {
  workName: string;
  designations: string[];
};

export type OrganizationLocation = {
  id: string;
  workName: string;
  opNumber: string;
  name: string;
  address: string;
  loaReference?: string;
  designation: string;
  status: 'active' | 'disabled';
  createdAt: string;
};

export type MasterDataType = 'designation' | 'employmentType' | 'skillCategory' | 'workName' | 'governmentType' | 'area';

export type SkillRate = {
  governmentType: string;
  area: string;
  salary: number;
};

export type SkillRateHistoryEntry = {
  rates: SkillRate[];
  effectiveFrom: string;
  effectiveTo: string;
  changedAt: string;
};

export type MasterDataItem = {
  id: string;
  type: MasterDataType;
  name: string;
  code: string;
  status: 'active' | 'disabled';
  designations?: string[];
  rates?: SkillRate[];
  effectiveFrom?: string;
  effectiveTo?: string;
  rateHistory?: SkillRateHistoryEntry[];
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
  organizationGovernmentType?: string;
  organizationArea?: string;
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
  otherAllowanceAmount?: number;
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
  disabledOn?: string;
  createdAt?: string;
};
