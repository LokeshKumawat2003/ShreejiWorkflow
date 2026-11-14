import { CheckCircleIcon, NotAllowedIcon, TimeIcon } from '@chakra-ui/icons';
import { SimpleGrid } from '@chakra-ui/react';
import { BuildingsArt, CheckArt, ClockArt, PeopleIcon, ShieldArt, StatCard } from '../../../components/ui';

type OrganizationStatsProps = {
  total: number;
  active: number;
  pending: number;
  inactive: number;
};

const ART_OPACITY = 0.45;

function OrganizationStats({ total, active, pending, inactive }: OrganizationStatsProps) {
  const share = (value: number) => (total ? value / total : 0);
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
      <StatCard label="Total Organizations" value={total} helper="All accounts" color="blue.500" icon={<PeopleIcon />} art={<BuildingsArt />} artOpacity={ART_OPACITY} />
      <StatCard label="Active" value={active} helper="Can sign in" share={share(active)} color="green.500" icon={<CheckCircleIcon />} art={<CheckArt />} artOpacity={ART_OPACITY} />
      <StatCard label="Pending" value={pending} helper="Awaiting setup" share={share(pending)} color="brand.500" icon={<TimeIcon />} art={<ClockArt />} artOpacity={ART_OPACITY + 0.15} />
      <StatCard label="Inactive" value={inactive} helper="Access disabled" share={share(inactive)} color="orange.500" icon={<NotAllowedIcon />} art={<ShieldArt palette="orange" />} artOpacity={ART_OPACITY} />
    </SimpleGrid>
  );
}

export default OrganizationStats;
