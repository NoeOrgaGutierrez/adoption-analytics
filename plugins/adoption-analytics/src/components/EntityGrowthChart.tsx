import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Chip from '@material-ui/core/Chip';
import FormControl from '@material-ui/core/FormControl';
import IconButton from '@material-ui/core/IconButton';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Popover from '@material-ui/core/Popover';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import MuiTooltip from '@material-ui/core/Tooltip';
import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { makeStyles } from '@material-ui/core/styles';
import type {
  AdoptionAnalyticsTimeRange,
  CatalogDimension,
  CatalogDimensionAnalytics,
  CatalogDimensionFilter,
  EntityGrowthPoint,
} from '@codeverse-gp/plugin-adoption-analytics-common';
import {
  Box as BoxIcon,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adoptionAnalyticsApiRef } from '../api';
import { ChartCard, chartPalette, useAxisStyle } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { isCatalogDimensionAvailable } from './catalogDimensionApplicability';
import { analyticsColors, monoFont, uiFont } from './tokens';

const ALL_KINDS = '__all__';
const MAX_CHART_SERIES = 8;
const MAX_FILTER_VALUES = 19;
const MAX_TABLE_ROWS = 20;

const DIMENSIONS: Array<{ value: CatalogDimension; label: string }> = [
  { value: 'kind', label: 'Kind' },
  { value: 'type', label: 'Type' },
  { value: 'owner', label: 'Owner' },
  { value: 'system', label: 'System' },
  { value: 'domain', label: 'Domain' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'namespace', label: 'Namespace' },
  { value: 'tag', label: 'Tag' },
];

const FILTER_ATTRIBUTES = [
  { value: 'type', label: 'Type' },
  { value: 'owner', label: 'Owner' },
  { value: 'system', label: 'System' },
  { value: 'domain', label: 'Domain' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'namespace', label: 'Namespace' },
  { value: 'tag', label: 'Tags' },
] as const;

type AttributeDimension = (typeof FILTER_ATTRIBUTES)[number]['value'];
type SearchDimension = AttributeDimension | 'annotation' | 'kind';
type TagMatch = 'and' | 'or';

type FilterSelection = Record<AttributeDimension, string[]> & {
  annotationKey: string;
  annotationValue: string;
  tagMatch: TagMatch;
};

const EMPTY_FILTERS: FilterSelection = {
  type: [],
  owner: [],
  system: [],
  domain: [],
  lifecycle: [],
  namespace: [],
  tag: [],
  annotationKey: '',
  annotationValue: '',
  tagMatch: 'or',
};

const SERIES_COLORS = [
  chartPalette.blue,
  chartPalette.teal,
  chartPalette.violet,
  chartPalette.amber,
  chartPalette.red,
  '#64748B',
  '#EC4899',
  '#22C55E',
] as const;

const KIND_COLORS: Record<string, string> = {
  Component: chartPalette.blue,
  API: chartPalette.teal,
  System: chartPalette.violet,
  Resource: chartPalette.amber,
  Domain: chartPalette.red,
  Group: '#64748B',
  User: '#EC4899',
};

const useStyles = makeStyles(theme => {
  const colors = analyticsColors(theme);
  return {
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    },
    toolbar: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
    },
    kindButton: {
      minWidth: 215,
      height: 40,
      justifyContent: 'space-between',
      borderColor: colors.border,
      color: colors.text,
      fontFamily: uiFont,
      fontSize: 13,
      textTransform: 'none',
    },
    filtersButton: {
      textTransform: 'none',
      fontFamily: uiFont,
      fontSize: 13,
      fontWeight: 500,
      borderColor: colors.border,
      color: colors.text,
    },
    filterCount: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      marginLeft: theme.spacing(0.5),
      padding: theme.spacing(0, 0.5),
      borderRadius: 9,
      color: '#fff',
      background: chartPalette.blue,
      fontSize: 11,
      lineHeight: 1,
    },
    clearAll: {
      marginLeft: 'auto',
      textTransform: 'none',
      fontFamily: uiFont,
      color: colors.muted,
    },
    activeChips: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    activeChip: {
      background: colors.hover,
      color: colors.text,
      fontFamily: uiFont,
      fontSize: 12,
      '& .MuiChip-deleteIcon': {
        color: colors.muted,
        '&:hover': {
          color: colors.text,
        },
      },
    },
    groupBy: {
      minWidth: 150,
    },
    groupBySelect: {
      fontFamily: uiFont,
      fontSize: 12,
      color: colors.text,
      '& .MuiSelect-select': {
        padding: '5px 28px 5px 10px',
      },
    },
    tagMatchOptions: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    },
    tagMatchButton: {
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
      color: colors.muted,
      minWidth: 42,
      height: 32,
      padding: theme.spacing(0, 1),
      fontFamily: uiFont,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.5,
    },
    tagMatchButtonActive: {
      borderColor: chartPalette.blue,
      background: colors.hover,
      color: chartPalette.blue,
    },
    popoverPaper: {
      width: 'min(650px, calc(100vw - 32px))',
      maxHeight: 'calc(100vh - 32px)',
      overflowY: 'auto',
      padding: theme.spacing(2),
      borderRadius: 10,
    },
    popoverHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1.5),
    },
    popoverTitle: {
      margin: 0,
      color: colors.text,
      fontFamily: uiFont,
      fontSize: 16,
      fontWeight: 600,
    },
    sectionLabel: {
      margin: 0,
      color: colors.muted,
      fontFamily: uiFont,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    attributeList: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
    },
    attributeRow: {
      display: 'grid',
      gridTemplateColumns: '145px minmax(0, 1fr)',
      gap: theme.spacing(1.5),
      alignItems: 'center',
      [theme.breakpoints.down('xs')]: {
        gridTemplateColumns: '1fr',
        gap: theme.spacing(0.5),
      },
    },
    attributeLabel: {
      color: colors.text,
      fontFamily: uiFont,
      fontSize: 13,
    },
    attributeControl: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
      minWidth: 0,
    },
    optionButton: {
      width: '100%',
      minHeight: 40,
      justifyContent: 'space-between',
      borderColor: colors.border,
      color: colors.text,
      fontFamily: uiFont,
      fontSize: 13,
      textAlign: 'left',
      textTransform: 'none',
    },
    optionPopoverPaper: {
      width: 'min(320px, calc(100vw - 32px))',
      padding: theme.spacing(1.5),
      borderRadius: 8,
    },
    optionPopoverContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    },
    optionList: {
      maxHeight: 280,
      overflowY: 'auto',
    },
    optionEmpty: {
      color: colors.muted,
      fontFamily: uiFont,
      fontSize: 12,
      padding: theme.spacing(1.5),
    },
    selectedValues: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    },
    selectedValueChip: {
      height: 22,
      background: colors.hover,
      color: colors.text,
      fontSize: 11,
    },
    placeholder: {
      color: colors.muted,
      fontFamily: uiFont,
      fontSize: 13,
    },
    annotationControls: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)',
      gap: theme.spacing(1),
      [theme.breakpoints.down('xs')]: {
        gridTemplateColumns: '1fr',
      },
    },
    popoverFooter: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
      paddingTop: theme.spacing(1.5),
      borderTop: `1px solid ${colors.border}`,
    },
    resetButton: {
      textTransform: 'none',
      fontFamily: uiFont,
      color: chartPalette.blue,
    },
    applyButton: {
      textTransform: 'none',
      fontFamily: uiFont,
      fontWeight: 600,
      color: '#fff',
      background: chartPalette.blue,
      '&:hover': {
        background: '#2563EB',
      },
    },
    muted: {
      marginTop: theme.spacing(2),
      color: colors.muted,
      fontFamily: uiFont,
      fontSize: 12,
    },
    error: {
      color: colors.negative,
      fontSize: 12,
      fontFamily: uiFont,
    },
    chart: {
      height: 280,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: monoFont,
      fontSize: 12,
    },
    head: {
      fontFamily: uiFont,
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.muted,
      textAlign: 'left',
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${colors.border}`,
    },
    cell: {
      padding: theme.spacing(1.25, 1.5),
      borderBottom: `1px solid ${colors.border}`,
      color: colors.text,
    },
    rowStripe: {
      background: colors.tableStripe,
    },
    numeric: {
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    },
    empty: {
      color: colors.muted,
      fontSize: 12,
      padding: theme.spacing(3, 0),
      textAlign: 'center',
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      padding: theme.spacing(3),
    },
    groupMore: {
      color: colors.muted,
      fontFamily: uiFont,
      fontSize: 11,
      padding: theme.spacing(1, 1.5),
    },
  };
});

type Props = {
  data: EntityGrowthPoint[];
  range: AdoptionAnalyticsTimeRange;
};

type Series = {
  key: string;
  label: string;
  color?: string;
};

export function EntityGrowthChart({ data, range }: Props) {
  const classes = useStyles();
  const axisStyle = useAxisStyle();
  const api = useApi(adoptionAnalyticsApiRef);
  const [groupBy, setGroupBy] = useState<CatalogDimension>('kind');
  const [kindFilter, setKindFilter] = useState(ALL_KINDS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterSelection>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<FilterSelection>(EMPTY_FILTERS);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [optionPopover, setOptionPopover] = useState<{
    dimension: SearchDimension;
    anchor: HTMLElement;
  } | null>(null);
  const [analytics, setAnalytics] = useState<CatalogDimensionAnalytics | null>(
    null,
  );
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const allKinds = useMemo(() => collectKinds(data), [data]);
  const activeKind =
    kindFilter !== ALL_KINDS && allKinds.includes(kindFilter)
      ? kindFilter
      : ALL_KINDS;
  const selectedKind = activeKind === ALL_KINDS ? undefined : activeKind;
  const days = daysForRange(range);
  const activeFilterCount = countActiveFilters(appliedFilters);
  const draftFilterValueCount = countFilterValues(draftFilters);
  const canAddDraftFilter = draftFilterValueCount < MAX_FILTER_VALUES;
  const hasDraftAnnotation =
    Boolean(draftFilters.annotationKey) &&
    Boolean(draftFilters.annotationValue.trim());
  const hasActiveFilters = activeFilterCount > 0;
  const hasAnySelection = activeKind !== ALL_KINDS || hasActiveFilters;
  const request = useMemo(() => {
    const requestFilters = toQueryFilters(appliedFilters);
    if (activeKind !== ALL_KINDS) {
      requestFilters.push({ dimension: 'kind', value: activeKind });
    }
    return { groupBy, filters: requestFilters };
  }, [activeKind, appliedFilters, groupBy]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .getCatalogDimensions(days, request.groupBy, request.filters)
        .then(result => {
          if (cancelled) return;
          setAnalytics(result);
          setLoading(false);
        })
        .catch(err => {
          if (cancelled) return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, days, request]);

  const { rows, series } = useMemo(
    () => buildChart(analytics, request.groupBy),
    [analytics, request.groupBy],
  );
  const latest = analytics?.snapshots[analytics.snapshots.length - 1];
  const dimensionLabel =
    DIMENSIONS.find(dimension => dimension.value === groupBy)?.label ??
    'Dimension';
  const countLabel =
    DIMENSIONS.find(dimension => dimension.value === request.groupBy)?.label ??
    'Dimension';
  let breakdownLabel = dimensionLabel;
  if (groupBy === 'kind') {
    breakdownLabel =
      activeKind === ALL_KINDS ? 'All kinds' : `Kind: ${activeKind}`;
  }
  const handleOpenFilters = (event: MouseEvent<HTMLButtonElement>) => {
    setOptionPopover(null);
    setDraftFilters(cloneFilters(appliedFilters));
    setFilterAnchor(event.currentTarget);
  };

  const handleCloseFilters = () => {
    setFilterAnchor(null);
    setOptionPopover(null);
  };

  const handleToggleOptionPopover = (
    dimension: SearchDimension,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    if (optionPopover?.dimension === dimension) {
      setOptionPopover(null);
      return;
    }
    if (dimension === 'kind') setFilterAnchor(null);
    setOptionPopover({ dimension, anchor: event.currentTarget });
  };

  const handleCloseOptionPopover = () => {
    setOptionPopover(null);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(cloneFilters(draftFilters));
    handleCloseFilters();
  };

  const handleResetDraft = () => {
    setDraftFilters(createEmptyFilters());
  };

  const handleClearAll = () => {
    setKindFilter(ALL_KINDS);
    setAppliedFilters(createEmptyFilters());
    setDraftFilters(createEmptyFilters());
    handleCloseOptionPopover();
    handleCloseFilters();
  };

  const handleSelectKind = (kind: string) => {
    const selected = kind === ALL_KINDS ? undefined : kind;
    setKindFilter(kind);
    setAppliedFilters(current => clearInapplicableFilters(current, selected));
    setDraftFilters(current => clearInapplicableFilters(current, selected));
    setGroupBy(current =>
      isCatalogDimensionAvailable(selected, current) ? current : 'kind',
    );
    setOptionPopover(null);
  };

  const removeFilterValue = (dimension: AttributeDimension, value: string) => {
    const removeValue = (current: FilterSelection) => ({
      ...current,
      [dimension]: current[dimension].filter(selected => selected !== value),
    });
    setAppliedFilters(removeValue);
    setDraftFilters(removeValue);
  };

  const removeAnnotationFilter = () => {
    const clearAnnotation = (current: FilterSelection) => ({
      ...current,
      annotationKey: '',
      annotationValue: '',
    });
    setAppliedFilters(clearAnnotation);
    setDraftFilters(clearAnnotation);
  };

  return (
    <ChartCard
      title="Entity Catalog Growth"
      subtitle={`${
        analytics?.snapshots.length ?? 0
      } snapshots · ${breakdownLabel}`}
      action={
        <FormControl
          variant="outlined"
          size="small"
          className={classes.groupBy}
        >
          <InputLabel id="catalog-growth-group-by-label">Group by</InputLabel>
          <Select
            className={classes.groupBySelect}
            labelId="catalog-growth-group-by-label"
            value={groupBy}
            onChange={event => {
              const value = String(event.target.value);
              if (isCatalogDimension(value)) setGroupBy(value);
            }}
            label="Group by"
          >
            {DIMENSIONS.map(dimension => (
              <MenuItem
                key={dimension.value}
                value={dimension.value}
                disabled={
                  !isCatalogDimensionAvailable(selectedKind, dimension.value)
                }
              >
                {dimension.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      }
    >
      <div className={classes.content}>
        <div className={classes.toolbar}>
          <Button
            className={classes.kindButton}
            variant="outlined"
            startIcon={<BoxIcon size={16} />}
            endIcon={
              optionPopover?.dimension === 'kind' ? (
                <ChevronUp size={15} />
              ) : (
                <ChevronDown size={15} />
              )
            }
            onClick={event => handleToggleOptionPopover('kind', event)}
            aria-haspopup="listbox"
            aria-expanded={optionPopover?.dimension === 'kind'}
          >
            Kind: {activeKind === ALL_KINDS ? 'All kinds' : activeKind}
          </Button>
          <Button
            className={classes.filtersButton}
            variant="outlined"
            startIcon={<SlidersHorizontal size={15} />}
            endIcon={
              filterAnchor ? <ChevronUp size={15} /> : <ChevronDown size={15} />
            }
            onClick={event => {
              if (filterAnchor) {
                handleCloseFilters();
              } else {
                handleOpenFilters(event);
              }
            }}
            aria-haspopup="dialog"
            aria-expanded={Boolean(filterAnchor)}
          >
            Filters
            {hasActiveFilters ? (
              <span className={classes.filterCount}>{activeFilterCount}</span>
            ) : null}
          </Button>
          {hasAnySelection ? (
            <Button className={classes.clearAll} onClick={handleClearAll}>
              Clear all
            </Button>
          ) : null}
        </div>

        <SearchableOptionPopover
          open={optionPopover?.dimension === 'kind'}
          anchorEl={
            optionPopover?.dimension === 'kind' ? optionPopover.anchor : null
          }
          options={[ALL_KINDS, ...allKinds]}
          selectedValues={[activeKind]}
          placeholder="Search kinds..."
          formatOption={value => (value === ALL_KINDS ? 'All kinds' : value)}
          onClose={handleCloseOptionPopover}
          onSelect={handleSelectKind}
        />

        {hasActiveFilters ? (
          <div className={classes.activeChips}>
            {FILTER_ATTRIBUTES.flatMap(attribute =>
              appliedFilters[attribute.value].map(value => (
                <Chip
                  className={classes.activeChip}
                  key={`${attribute.value}:${value}`}
                  label={`${
                    attribute.value === 'tag'
                      ? `Tag (${appliedFilters.tagMatch.toUpperCase()})`
                      : attribute.label.replace(/s$/, '')
                  }: ${value}`}
                  onDelete={() => removeFilterValue(attribute.value, value)}
                  size="small"
                />
              )),
            )}
            {appliedFilters.annotationKey && appliedFilters.annotationValue ? (
              <Chip
                className={classes.activeChip}
                label={`${appliedFilters.annotationKey}: ${appliedFilters.annotationValue}`}
                onDelete={removeAnnotationFilter}
                size="small"
              />
            ) : null}
          </div>
        ) : null}

        <Popover
          open={Boolean(filterAnchor)}
          anchorEl={filterAnchor}
          onClose={handleCloseFilters}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{ className: classes.popoverPaper }}
        >
          <div className={classes.popoverHeader}>
            <h4 className={classes.popoverTitle}>Filter catalog</h4>
            <IconButton
              aria-label="Close filters"
              size="small"
              onClick={handleCloseFilters}
            >
              <X size={17} />
            </IconButton>
          </div>
          <p className={classes.sectionLabel}>Entity attributes</p>
          <div className={classes.attributeList}>
            {FILTER_ATTRIBUTES.map(attribute => {
              const isOpen = optionPopover?.dimension === attribute.value;
              const selectedValues = draftFilters[attribute.value];
              const isAvailable = isCatalogDimensionAvailable(
                selectedKind,
                attribute.value,
              );
              return (
                <div className={classes.attributeRow} key={attribute.value}>
                  <span className={classes.attributeLabel}>
                    {attribute.label}
                  </span>
                  <div className={classes.attributeControl}>
                    <MuiTooltip
                      title={`${attribute.label} is not applicable to ${activeKind} entities`}
                      disableHoverListener={isAvailable}
                    >
                      <span>
                        <Button
                          className={classes.optionButton}
                          variant="outlined"
                          disabled={!isAvailable}
                          onClick={event =>
                            handleToggleOptionPopover(attribute.value, event)
                          }
                          endIcon={
                            isOpen ? (
                              <ChevronUp size={15} />
                            ) : (
                              <ChevronDown size={15} />
                            )
                          }
                          aria-haspopup="listbox"
                          aria-expanded={isOpen}
                        >
                          {selectedValues.length === 0 ? (
                            <span className={classes.placeholder}>
                              All {attribute.label.toLowerCase()}
                            </span>
                          ) : (
                            <div className={classes.selectedValues}>
                              {selectedValues.map(value => (
                                <Chip
                                  className={classes.selectedValueChip}
                                  key={value}
                                  label={value}
                                  size="small"
                                />
                              ))}
                            </div>
                          )}
                        </Button>
                      </span>
                    </MuiTooltip>
                    <SearchableOptionPopover
                      open={isOpen}
                      anchorEl={
                        optionPopover?.dimension === attribute.value
                          ? optionPopover.anchor
                          : null
                      }
                      options={analytics?.options[attribute.value] ?? []}
                      selectedValues={selectedValues}
                      disabled={!isAvailable}
                      multiple
                      placeholder={`Search ${attribute.label.toLowerCase()}...`}
                      canSelect={canAddDraftFilter}
                      onClose={handleCloseOptionPopover}
                      onSelect={value =>
                        setDraftFilters(current => {
                          const currentValues = current[attribute.value];
                          return {
                            ...current,
                            [attribute.value]: toggleSelectedValue(
                              currentValues,
                              value,
                              canAddDraftFilter,
                            ),
                          };
                        })
                      }
                    />
                    {attribute.value === 'tag' ? (
                      <div
                        className={classes.tagMatchOptions}
                        role="group"
                        aria-label="Tag matching logic"
                      >
                        <MuiTooltip title="Match any selected tag (OR)">
                          <IconButton
                            className={
                              draftFilters.tagMatch === 'or'
                                ? `${classes.tagMatchButton} ${classes.tagMatchButtonActive}`
                                : classes.tagMatchButton
                            }
                            aria-label="Match any selected tag (OR)"
                            aria-pressed={draftFilters.tagMatch === 'or'}
                            size="small"
                            onClick={() =>
                              setDraftFilters(current => ({
                                ...current,
                                tagMatch: 'or',
                              }))
                            }
                          >
                            OR
                          </IconButton>
                        </MuiTooltip>
                        <MuiTooltip title="Match all selected tags (AND)">
                          <IconButton
                            className={
                              draftFilters.tagMatch === 'and'
                                ? `${classes.tagMatchButton} ${classes.tagMatchButtonActive}`
                                : classes.tagMatchButton
                            }
                            aria-label="Match all selected tags (AND)"
                            aria-pressed={draftFilters.tagMatch === 'and'}
                            size="small"
                            onClick={() =>
                              setDraftFilters(current => ({
                                ...current,
                                tagMatch: 'and',
                              }))
                            }
                          >
                            AND
                          </IconButton>
                        </MuiTooltip>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div className={classes.attributeRow}>
              <span className={classes.attributeLabel}>Annotations</span>
              <div className={classes.annotationControls}>
                <div className={classes.attributeControl}>
                  <Button
                    className={classes.optionButton}
                    variant="outlined"
                    disabled={!hasDraftAnnotation && !canAddDraftFilter}
                    onClick={event =>
                      handleToggleOptionPopover('annotation', event)
                    }
                    endIcon={
                      optionPopover?.dimension === 'annotation' ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )
                    }
                    aria-haspopup="listbox"
                    aria-expanded={optionPopover?.dimension === 'annotation'}
                    aria-label="Select annotation key"
                  >
                    {draftFilters.annotationKey || 'Select annotation...'}
                  </Button>
                  <SearchableOptionPopover
                    open={optionPopover?.dimension === 'annotation'}
                    anchorEl={
                      optionPopover?.dimension === 'annotation'
                        ? optionPopover.anchor
                        : null
                    }
                    options={analytics?.options.annotations ?? []}
                    selectedValues={
                      draftFilters.annotationKey
                        ? [draftFilters.annotationKey]
                        : []
                    }
                    placeholder="Search annotation keys..."
                    disabled={!hasDraftAnnotation && !canAddDraftFilter}
                    onClose={handleCloseOptionPopover}
                    onSelect={value =>
                      setDraftFilters(current => ({
                        ...current,
                        annotationKey: value,
                        annotationValue: '',
                      }))
                    }
                  />
                </div>
                <TextField
                  variant="outlined"
                  size="small"
                  placeholder="Enter value..."
                  value={draftFilters.annotationValue}
                  disabled={
                    !draftFilters.annotationKey ||
                    (!hasDraftAnnotation && !canAddDraftFilter)
                  }
                  inputProps={{
                    'aria-label': 'Filter by annotation value',
                    maxLength: 512,
                  }}
                  onChange={event =>
                    setDraftFilters(current => ({
                      ...current,
                      annotationValue: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <div className={classes.muted}>
            {draftFilterValueCount} of {MAX_FILTER_VALUES} filter values
            selected
          </div>
          <div className={classes.popoverFooter}>
            <Button className={classes.resetButton} onClick={handleResetDraft}>
              Reset
            </Button>
            <Button
              className={classes.applyButton}
              variant="contained"
              onClick={handleApplyFilters}
            >
              Apply filters
            </Button>
          </div>
        </Popover>

        {loading && !analytics ? (
          <div className={classes.loading}>
            <Progress />
          </div>
        ) : null}
        {error ? (
          <div className={classes.error}>
            Failed to load catalog growth: {error.message}
          </div>
        ) : null}
        {analytics && analytics.snapshots.length === 0 ? (
          <div className={classes.empty}>
            No catalog snapshots are available yet.
          </div>
        ) : null}
        {analytics && analytics.snapshots.length > 0 && series.length === 0 ? (
          <div className={classes.empty}>
            No catalog entities match the selected filters.
          </div>
        ) : null}
        {analytics && series.length > 0 ? (
          <>
            <div className={classes.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rows}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={axisStyle.axisLine.stroke}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={axisStyle.tick}
                    axisLine={axisStyle.axisLine}
                    tickLine={axisStyle.tickLine}
                    tickFormatter={compactDate}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={axisStyle.tick}
                    axisLine={axisStyle.axisLine}
                    tickLine={axisStyle.tickLine}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontFamily: monoFont, fontSize: 11 }}
                    iconType="square"
                  />
                  {series.map((item, index) => (
                    <Line
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      name={item.label}
                      stroke={
                        item.color ??
                        SERIES_COLORS[index % SERIES_COLORS.length]
                      }
                      strokeWidth={2}
                      dot={analytics.snapshots.length <= 1}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {latest && latest.counts.length > 0 ? (
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th className={classes.head}>{countLabel}</th>
                    <th className={`${classes.head} ${classes.numeric}`}>
                      Entities
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latest.counts
                    .slice(0, MAX_TABLE_ROWS)
                    .map((count, index) => (
                      <tr
                        key={seriesKey(count.value)}
                        className={
                          index % 2 === 1 ? classes.rowStripe : undefined
                        }
                      >
                        <td className={classes.cell}>
                          {count.value ?? 'Unassigned'}
                        </td>
                        <td className={`${classes.cell} ${classes.numeric}`}>
                          {count.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : null}
            {latest && latest.counts.length > MAX_TABLE_ROWS ? (
              <div className={classes.groupMore}>
                Showing {MAX_TABLE_ROWS} of {latest.counts.length} groups.
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ChartCard>
  );
}

type SearchableOptionPopoverProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  options: string[];
  selectedValues: string[];
  placeholder: string;
  multiple?: boolean;
  canSelect?: boolean;
  disabled?: boolean;
  formatOption?: (value: string) => string;
  onClose: () => void;
  onSelect: (value: string) => void;
};

function SearchableOptionPopover({
  open,
  anchorEl,
  options,
  selectedValues,
  placeholder,
  multiple = false,
  canSelect = true,
  disabled = false,
  formatOption = value => value,
  onClose,
  onSelect,
}: SearchableOptionPopoverProps) {
  const classes = useStyles();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const matchingOptions = options.filter(option =>
    formatOption(option).toLowerCase().includes(search.trim().toLowerCase()),
  );
  const visibleOptions = [
    ...selectedValues.filter(value => !matchingOptions.includes(value)),
    ...matchingOptions,
  ];

  return (
    <Popover
      open={open && !disabled}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ className: classes.optionPopoverPaper }}
    >
      <div className={classes.optionPopoverContent}>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder={placeholder}
          value={search}
          onChange={event => setSearch(event.target.value)}
          inputProps={{ 'aria-label': placeholder }}
        />
        <div
          className={classes.optionList}
          role="listbox"
          aria-multiselectable={multiple}
        >
          {visibleOptions.length === 0 ? (
            <div className={classes.optionEmpty}>No matching options</div>
          ) : (
            visibleOptions.map(value => {
              const selected = selectedValues.includes(value);
              return (
                <MenuItem
                  key={value}
                  selected={selected}
                  disabled={!selected && !canSelect}
                  onClick={() => {
                    onSelect(value);
                    if (!multiple) onClose();
                  }}
                  role="option"
                  aria-selected={selected}
                >
                  {multiple ? (
                    <Checkbox
                      checked={selected}
                      color="default"
                      size="small"
                      tabIndex={-1}
                      disableRipple
                    />
                  ) : null}
                  {formatOption(value)}
                </MenuItem>
              );
            })
          )}
        </div>
      </div>
    </Popover>
  );
}

function toQueryFilters(filters: FilterSelection): CatalogDimensionFilter[] {
  const queryFilters: CatalogDimensionFilter[] = [];
  for (const { value } of FILTER_ATTRIBUTES) {
    for (const selected of filters[value]) {
      if (value === 'tag') {
        queryFilters.push({
          dimension: value,
          value: selected,
          match: filters.tagMatch,
        });
      } else {
        queryFilters.push({ dimension: value, value: selected });
      }
    }
  }
  if (filters.annotationKey && filters.annotationValue.trim()) {
    queryFilters.push({
      dimension: 'annotation',
      key: filters.annotationKey,
      value: filters.annotationValue.trim(),
    });
  }
  return queryFilters;
}

function buildChart(
  data: CatalogDimensionAnalytics | null,
  groupBy: CatalogDimension,
): {
  rows: Array<Record<string, number | string>>;
  series: Series[];
} {
  if (!data) return { rows: [], series: [] };
  const totals = new Map<string | null, number>();
  for (const snapshot of data.snapshots) {
    for (const count of snapshot.counts) {
      totals.set(count.value, (totals.get(count.value) ?? 0) + count.count);
    }
  }
  const groups = [...totals.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (a[0] === null) return 1;
    if (b[0] === null) return -1;
    return a[0].localeCompare(b[0]);
  });
  const visibleGroups = groups.slice(0, MAX_CHART_SERIES);
  const otherGroups = groups.slice(MAX_CHART_SERIES);
  const series: Series[] = visibleGroups.map(([value]) => ({
    key: seriesKey(value),
    label: value ?? 'Unassigned',
    color: groupBy === 'kind' && value ? KIND_COLORS[value] : undefined,
  }));
  if (otherGroups.length > 0) {
    series.push({ key: '__other', label: 'Other' });
  }

  const visibleKeys = new Set(visibleGroups.map(([value]) => value));
  const rows = data.snapshots.map(snapshot => {
    const counts = new Map(
      snapshot.counts.map(count => [count.value, count.count] as const),
    );
    const row: Record<string, number | string> = { date: snapshot.date };
    for (const [value] of visibleGroups) {
      row[seriesKey(value)] = counts.get(value) ?? 0;
    }
    if (otherGroups.length > 0) {
      row.__other = snapshot.counts.reduce(
        (sum, count) => sum + (visibleKeys.has(count.value) ? 0 : count.count),
        0,
      );
    }
    return row;
  });
  return { rows, series };
}

function collectKinds(data: EntityGrowthPoint[]): string[] {
  const seen = new Set<string>();
  for (const point of data) {
    for (const kind of Object.keys(point.counts)) {
      seen.add(kind);
    }
  }
  return [...seen].sort();
}

function countActiveFilters(filters: FilterSelection): number {
  const selectedAttributes = FILTER_ATTRIBUTES.filter(
    attribute => filters[attribute.value].length > 0,
  ).length;
  return (
    selectedAttributes +
    (filters.annotationKey && filters.annotationValue.trim() ? 1 : 0)
  );
}

function countFilterValues(filters: FilterSelection): number {
  const attributeValueCount = FILTER_ATTRIBUTES.reduce(
    (count, attribute) => count + filters[attribute.value].length,
    0,
  );
  return (
    attributeValueCount +
    (filters.annotationKey && filters.annotationValue.trim() ? 1 : 0)
  );
}

function cloneFilters(filters: FilterSelection): FilterSelection {
  return {
    type: [...filters.type],
    owner: [...filters.owner],
    system: [...filters.system],
    domain: [...filters.domain],
    lifecycle: [...filters.lifecycle],
    namespace: [...filters.namespace],
    tag: [...filters.tag],
    annotationKey: filters.annotationKey,
    annotationValue: filters.annotationValue,
    tagMatch: filters.tagMatch ?? 'or',
  };
}

function clearInapplicableFilters(
  filters: FilterSelection,
  kind: string | undefined,
): FilterSelection {
  const updated = cloneFilters(filters);
  for (const { value } of FILTER_ATTRIBUTES) {
    if (!isCatalogDimensionAvailable(kind, value)) {
      updated[value] = [];
    }
  }
  return updated;
}

function createEmptyFilters(): FilterSelection {
  return cloneFilters(EMPTY_FILTERS);
}

function toggleSelectedValue(
  currentValues: string[],
  value: string,
  canAdd: boolean,
): string[] {
  if (currentValues.includes(value)) {
    return currentValues.filter(selected => selected !== value);
  }
  return canAdd ? [...currentValues, value] : currentValues;
}

function daysForRange(range: AdoptionAnalyticsTimeRange): number {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return 30;
  }
}

function isCatalogDimension(value: string): value is CatalogDimension {
  return DIMENSIONS.some(dimension => dimension.value === value);
}

function seriesKey(value: string | null): string {
  return value === null ? '__unassigned' : `value:${value}`;
}

function compactDate(iso: string): string {
  return iso.slice(5);
}
