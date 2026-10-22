import { StatStrip } from '../../../components/ui';

type OrganizationStatsProps = {
  total: number;
  active: number;
  pending: number;
  inactive: number;
};

function OrganizationStats({ total, active, pending, inactive }: OrganizationStatsProps) {
  return (
    <StatStrip
      items={[
        { label: 'Total Organizations', value: total, helper: 'All accounts', color: 'brand.500' },
        { label: 'Active', value: active, helper: 'Can sign in', color: 'green.500' },
        { label: 'Pending', value: pending, helper: 'Awaiting setup', color: 'orange.500' },
        { label: 'Inactive', value: inactive, helper: 'Access disabled' },
      ]}
    />
  );
}

export default OrganizationStats;
