import { AtSignIcon, CalendarIcon, InfoIcon, TimeIcon } from '@chakra-ui/icons';
import { Box, Grid, GridItem, Heading, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import FeatureTile from './FeatureTile';

function PeopleGlyph() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="6" r="3.5" />
            <circle cx="4.5" cy="9" r="2.5" />
            <circle cx="19.5" cy="9" r="2.5" />
            <path d="M5 19c0-4.2 2.7-7 7-7s7 2.8 7 7v1H5v-1ZM.5 18c0-2.8 1.4-4.7 3.8-5.3-.9 1.4-1.4 3.2-1.4 5.3v2H.5v-2Zm23 0c0-2.1-.5-3.9-1.4-5.3 2.4.6 3.8 2.5 3.8 5.3v2h-3.8v-2Z" />
        </svg>
    );
}

function PayrollGlyph() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
            <path d="M14.8 8.5c-.6-.6-1.5-.9-2.6-.9-1.4 0-2.4.7-2.4 1.8 0 2.8 5.1 1.1 5.1 4 0 1.1-1 2-2.7 2-1.1 0-2.2-.4-3-1.2M12.3 6.4v11.2" stroke="white" />
        </svg>
    );
}

function ExpenseGlyph() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path d="M5 2h14v20l-3.5-2-3.5 2-3.5-2L5 22V2Z" />
            <path d="M8 7h8M8 10h8M8 13h5" fill="none" stroke="white" strokeWidth="1.4" />
        </svg>
    );
}

function ReportGlyph() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <rect x="3" y="12" width="5" height="9" rx="1" />
            <rect x="10" y="7" width="5" height="14" rx="1" />
            <rect x="17" y="3" width="5" height="18" rx="1" />
        </svg>
    );
}

function AuthStoryPanel() {
    return (
        <Stack position="relative" zIndex={1} flex="1" minH={0} spacing={0}>
            <Box mt={{ lg: '124px', xl: '128px' }}>
                <Heading as="h2" maxW="460px" fontSize={{ lg: '2xl', xl: '3xl' }} lineHeight="1.12" fontWeight="800">
                    Your Complete<br />
                    <Text as="span" color="brand.500">Employee Management</Text><br />
                    Solution
                </Heading>
                <Text mt={2} maxW="390px" color="slate.500" fontSize="sm" lineHeight="1.5">
                    Simplify HR processes, manage attendance,<br />
                    handle payroll, track expenses and more &mdash; all<br />
                    in one place.
                </Text>
            </Box>
            <Grid
                templateColumns="repeat(4, 70px)"
                gap={2}
                justifyContent="end"
                alignSelf="end"
                mr={{ lg: -5, xl: -6 }}
                mt={4}
                mb={-16}
                zIndex={1}
                aria-label="HR platform features"
            >
                <FeatureTile icon={<PeopleGlyph />} label="Employees" tone="blue" />
                <FeatureTile icon={<CalendarIcon />} label="Attendance" tone="green" />
                <FeatureTile icon={<PayrollGlyph />} label="Payroll" tone="violet" />
                <FeatureTile icon={<ExpenseGlyph />} label="Expenses" tone="amber" />
                <GridItem colStart={4}>
                    <FeatureTile icon={<ReportGlyph />} label="Reports" tone="cyan" />
                </GridItem>
            </Grid>
            <SimpleGrid columns={3} mt="auto" pb={2}>
                {[
                    { icon: <InfoIcon />, title: 'Secure', detail: 'Your data is safe' },
                    { icon: <TimeIcon />, title: 'Efficient', detail: 'Save time & effort' },
                    { icon: <AtSignIcon />, title: 'Scalable', detail: 'Grow with your team' },
                ].map((benefit, index) => (
                    <HStack
                        key={benefit.title}
                        spacing={2}
                        pl={index === 0 ? 0 : 3}
                        borderLeft={index === 0 ? 'none' : '1px solid'}
                        borderColor="blue.100"
                        color="blue.700"
                    >
                        <Box color="blue.600" fontSize="xl">{benefit.icon}</Box>
                        <Box>
                            <Text fontSize="xs" fontWeight="700">{benefit.title}</Text>
                            <Text fontSize="2xs" color="blue.500" whiteSpace="nowrap">
                                {benefit.detail}
                            </Text>
                        </Box>
                    </HStack>
                ))}
            </SimpleGrid>
        </Stack>
    );
}

export default AuthStoryPanel;
