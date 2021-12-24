import { Accordion, AccordionDetails } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import React from 'react';

const getDetailsClasses = makeStyles((theme) => ({
  root: {
    '&, &:first-child, &:last-child': {
      margin: '1.2em 0 !important',
    },
    borderLeft: '.3rem solid',
    borderLeftColor: theme.palette.details.border,
    boxShadow: theme.shadows[1],
  },
  expanded: {
    '&, &:first-child, &:last-child': {
      margin: '1.2em 0 !important',
    },
  },
}));

const useStyles = makeStyles(theme => ({
  container: {
    width: `calc(100% - ${theme.spacing(2) * 2}px)`,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
}));

export interface DetailsProps {
  className: string;
  children: string[] | string;
}

const Details: React.FC<DetailsProps> = (props) => {
  const { className = '', children } = props;
  const detailsClasses = getDetailsClasses();
  const classes = useStyles();
  const cont = Array.isArray(children) ? children : [children];
  return (
    <Accordion
      variant="outlined"
      classes={detailsClasses}
      defaultExpanded={!!className.match('open')}
    >
      {cont[0]}
      <AccordionDetails style={{ padding: '0' }}>
        <div className={classes.container}>{cont.slice(1)}</div>
      </AccordionDetails>
    </Accordion>
  );
};

export default Details;
