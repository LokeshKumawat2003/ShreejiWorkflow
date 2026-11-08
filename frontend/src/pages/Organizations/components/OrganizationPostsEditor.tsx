import { Badge, Box, Checkbox, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import type { MasterDataItem, OrganizationPost } from '../../../types';

type OrganizationPostsEditorProps = {
  posts: OrganizationPost[];
  workNames: MasterDataItem[];
  isLoading: boolean;
  onChange: (posts: OrganizationPost[]) => void;
};

type WorkNameOption = { key: string; name: string; designations: string[]; isInactive: boolean };

function sameName(first: string, second: string) {
  return first.toLowerCase() === second.toLowerCase();
}

function OrganizationPostsEditor({ posts, workNames, isLoading, onChange }: OrganizationPostsEditorProps) {
  const options: WorkNameOption[] = workNames.map((item) => ({
    key: item.id,
    name: item.name,
    designations: item.designations || [],
    isInactive: false,
  }));
  for (const post of posts) {
    if (!options.some((option) => sameName(option.name, post.workName))) {
      options.push({ key: `saved-${post.workName}`, name: post.workName, designations: [], isInactive: true });
    }
  }

  function findPost(workName: string) {
    return posts.find((post) => sameName(post.workName, workName));
  }

  function availableDesignations(option: WorkNameOption) {
    const saved = findPost(option.name)?.designations || [];
    return [...option.designations, ...saved.filter((name) => !option.designations.some((item) => sameName(item, name)))];
  }

  function toggleWorkName(option: WorkNameOption, isChecked: boolean) {
    onChange(isChecked
      ? [...posts, { workName: option.name, designations: [...option.designations] }]
      : posts.filter((post) => !sameName(post.workName, option.name)));
  }

  function setDesignations(workName: string, designations: string[]) {
    onChange(posts.map((post) => (sameName(post.workName, workName) ? { ...post, designations } : post)));
  }

  function toggleDesignation(workName: string, designation: string, isChecked: boolean) {
    const current = findPost(workName)?.designations || [];
    setDesignations(workName, isChecked
      ? current.some((item) => sameName(item, designation)) ? current : [...current, designation]
      : current.filter((item) => !sameName(item, designation)));
  }

  if (isLoading) return <Text fontSize="sm" color="slate.500">Loading work names…</Text>;
  if (options.length === 0) {
    return <Text fontSize="sm" color="slate.500">No work names yet. Add them in Settings → Master data → Work name.</Text>;
  }

  return (
    <Stack spacing={3}>
      <Text fontSize="sm" color="slate.500">
        Tick every work name this organization needs. You can select more than one, then choose the designations under each.
      </Text>
      {options.map((option) => {
        const post = findPost(option.name);
        const designations = availableDesignations(option);
        const allSelected = Boolean(post) && designations.every((name) => post?.designations.some((item) => sameName(item, name)));
        return (
          <Box
            key={option.key}
            border="1px solid"
            borderColor={post ? 'brand.200' : 'slate.200'}
            bg={post ? 'white' : 'slate.50'}
            borderRadius="md"
            overflow="hidden"
          >
            <HStack px={4} py={3} justify="space-between" bg={post ? 'brand.50' : undefined}>
              <Checkbox colorScheme="brand" isChecked={Boolean(post)} onChange={(event) => toggleWorkName(option, event.target.checked)}>
                <Text fontSize="sm" fontWeight="600" color="slate.900">{option.name}</Text>
              </Checkbox>
              <HStack spacing={2}>
                {option.isInactive ? <Badge colorScheme="gray">Inactive</Badge> : null}
                <Text fontSize="xs" color="slate.500">
                  {post ? `${post.designations.length} of ${designations.length} selected` : `${designations.length} designation${designations.length === 1 ? '' : 's'}`}
                </Text>
              </HStack>
            </HStack>
            {post ? (
              <Box px={4} py={3} borderTop="1px solid" borderColor="slate.100">
                <HStack mb={2} justify="space-between">
                  <Text fontSize="xs" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="0.04em">Designations</Text>
                  <Checkbox size="sm" colorScheme="brand" isChecked={allSelected} onChange={(event) => setDesignations(option.name, event.target.checked ? designations : [])}>
                    Select all
                  </Checkbox>
                </HStack>
                <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2}>
                  {designations.map((name) => (
                    <Checkbox
                      key={name}
                      colorScheme="brand"
                      isChecked={post.designations.some((item) => sameName(item, name))}
                      onChange={(event) => toggleDesignation(option.name, name, event.target.checked)}
                    >
                      <Text fontSize="sm">{name}</Text>
                    </Checkbox>
                  ))}
                </SimpleGrid>
                {post.designations.length === 0 ? (
                  <Text mt={2} fontSize="xs" color="red.500">Select at least one designation, or untick this work name.</Text>
                ) : null}
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}

export default OrganizationPostsEditor;
