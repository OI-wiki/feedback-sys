// Components
import { Button, List, ListItem, ListItemIcon, ListItemText, Typography } from '@material-ui/core';

import BookIcon from '@material-ui/icons/Book';
import ArrowBackIosIcon from '@material-ui/icons/ArrowBackIos';

import { graphql } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';
import StyledLayout from '../components/StyledLayout';

const Tags = ({ pageContext, data, location }) => {
  const { tag } = pageContext;
  const { edges, totalCount } = data.allMarkdownRemark;
  const tagHeader = `共 ${totalCount} 篇文章被打上了 <code>${tag}</code> 标签：`;

  return (
    <StyledLayout location={location} noMeta={true} title={`标签页 - ${tag}`}>
      <div>
        <Typography variant="h5" component="h2" dangerouslySetInnerHTML={{ __html: tagHeader }}>
        </Typography>
        <List>
          {edges.map(({ node }) => {
            const { slug } = node.fields;
            const { title } = node.frontmatter;
            return (
              <ListItem button divider component="a" href={slug} key={slug}>
                <ListItemIcon>
                  <BookIcon/>
                </ListItemIcon>
                <ListItemText primary={title}/>
              </ListItem>
            );
          })}
        </List>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIosIcon/>}
          href="/tags"
        >
          所有标签
        </Button>
      </div>
    </StyledLayout>
  );
};

Tags.propTypes = {
  pageContext: PropTypes.shape({
    tag: PropTypes.string.isRequired,
  }),
  data: PropTypes.shape({
    allMarkdownRemark: PropTypes.shape({
      totalCount: PropTypes.number.isRequired,
      edges: PropTypes.arrayOf(
        PropTypes.shape({
          node: PropTypes.shape({
            frontmatter: PropTypes.shape({
              title: PropTypes.string.isRequired,
            }),
            fields: PropTypes.shape({
              slug: PropTypes.string.isRequired,
            }),
          }),
        }).isRequired,
      ),
    }),
  }),
};

export default Tags;

export const pageQuery = graphql`
  query($tag: String) {
    allMarkdownRemark(
      limit: 2000
      sort: { fields: [frontmatter___title], order: DESC }
      filter: { frontmatter: { tags: { in: [$tag] } } }
    ) {
      totalCount
      edges {
        node {
          fields {
            slug
          }
          frontmatter {
            title
          }
        }
      }
    }
  }
`;
