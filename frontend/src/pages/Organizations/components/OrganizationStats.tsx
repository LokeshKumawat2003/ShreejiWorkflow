import { CheckCircleIcon, NotAllowedIcon, TimeIcon } from '@chakra-ui/icons';
import { BuildingIcon, StatStrip } from '../../../components/ui';

type OrganizationStatsProps = {
  total: number;
  active: number;
  pending: number;
  inactive: number;
};

function OrganizationStats({ total, active, pending, inactive }: OrganizationStatsProps) {
  const share = (value: number) => (total ? value / total : null);
  return (
    <StatStrip
      items={[
        { label: 'Total Organizations', value: total, helper: 'All accounts', color: 'brand.500', icon: <BuildingIcon boxSize={5} /> },
        { label: 'Active', value: active, helper: 'Can sign in', color: 'green.500', icon: <CheckCircleIcon boxSize={5} />, share: share(active) },
        { label: 'Pending', value: pending, helper: 'Awaiting setup', color: 'orange.400', icon: <TimeIcon boxSize={5} />, share: share(pending) },
        { label: 'Inactive', value: inactive, helper: 'Access disabled', color: 'red.400', icon: <NotAllowedIcon boxSize={5} />, share: share(inactive) },
      ]}
    />
  );
}

export default OrganizationStats;
