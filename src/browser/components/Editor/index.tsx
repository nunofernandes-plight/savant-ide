import * as React from 'react';
// @ts-ignore
import * as brace from 'brace';
import AceEditor from 'react-ace';
import 'brace/theme/tomorrow';
import 'brace/mode/ocaml';
import 'brace/ext/searchbox';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import Measure, { ContentRect } from 'react-measure';
import styled from 'styled-components';

import Controls from './Controls';
import Notification from './Notification';
import { ApplicationState } from '../../store/index';
import * as fsActions from '../../store/fs/actions';
import { ContractSrcFile } from '../../store/fs/types';

const Editor = styled(AceEditor)`
  .error-marker {
    position: absolute;
  }

  .error-marker:after {
    position: relative;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1.5px;
    background: linear-gradient(45deg, transparent, transparent 49%, red 49%, transparent 51%);
  }
`;

const Wrapper = styled.div`
  flex: 1;
  min-width: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

interface OwnProps {}
interface MappedProps {
  blocknum: number;
  contract: ContractSrcFile;
}

interface DispatchProps {
  check: typeof fsActions.check;
  update: typeof fsActions.update;
}

type Props = OwnProps & MappedProps & DispatchProps;

interface State {
  contract: ContractSrcFile;
  dimensions: { width: number; height: number };
  notifications: any[];
  snackbar: { open: boolean; message: any; key: number };
}

class ScillaEditor extends React.Component<Props, State> {
  static getDerivedStateFromProps(props: Props, state: State) {
    // the contract has been deleted; clear state.
    if (!props.contract) {
      return { ...state, contract: { name: '', code: '' } };
    }

    // a new contract has been loaded.
    if (state.contract && state.contract.name !== props.contract.name) {
      return { ...state, contract: props.contract };
    }

    // the contract was checked, and an error occurred.
    if (state.contract && state.contract.error !== props.contract.error) {
      return { ...state, contract: { ...state.contract, error: props.contract.error } };
    }

    return null;
  }

  state: State = {
    contract: {
      name: '',
      code: '',
      error: null,
    },
    dimensions: {
      height: -1,
      width: -1,
    },
    notifications: [],
    snackbar: { open: false, message: null, key: 0 },
  };

  handleCheck = () => {
    const { check } = this.props;
    const { contract } = this.state;
    check(contract.code, this.handleCheckRes);
  };

  handleCheckRes = (res: any) => {
    this.setState((state) => ({ notifications: state.notifications.concat([res]) }));

    if (this.state.snackbar.open) {
      this.setState((state) => ({ snackbar: { ...state.snackbar, open: false } }));
      return;
    }

    this.handleDisplayNext();
  };

  handleCloseSnackbar = () => {
    this.setState({ snackbar: { ...this.state.snackbar, open: false } });
  };

  handleDisplayNext = () => {
    if (this.state.notifications.length) {
      const [head, ...tail] = this.state.notifications;

      this.setState({
        notifications: tail,
        snackbar: { open: true, message: head, key: new Date().getTime() },
      });

      return;
    }
  };

  handleSave = () => {
    const { update } = this.props;
    const { contract } = this.state;
    update(contract.name, contract.code);
  };

  handleResize = (contentRect: ContentRect): void => {
    if (contentRect && contentRect.bounds) {
      const { height, width } = contentRect.bounds;
      this.setState({ dimensions: { height, width } });
    }
  };

  onChange = (value: string): void => {
    this.setState({ contract: { ...this.state.contract, code: value } });
  };

  getAnnotations = (): any => {
    const { contract } = this.state;
    console.log(contract);

    if (contract.error && contract.error.message) {
      const markers = contract.error.message.map((err: any) => {
        const row = parseInt(err.line, 10);
        const col = parseInt(err.column, 10);

        return {
          row: row === 0 ? 0 : row - 1,
          col,
          type: 'error',
          text: err.msg,
        };
      });

      return markers;
    }

    return [];
  };

  render() {
    const { contract, snackbar } = this.state;

    return (
      <Measure bounds onResize={this.handleResize}>
        {({ measureRef }) => (
          <Wrapper innerRef={measureRef}>
            <Notification
              key={snackbar.key}
              onClose={this.handleCloseSnackbar}
              onExited={this.handleDisplayNext}
              open={snackbar.open}
              msg={
                snackbar.open && snackbar.message.result === 'success'
                  ? 'Type-checking succeeded.'
                  : 'Type-checking failed.'
              }
              variant={snackbar.message && snackbar.message.result}
            />
            <Controls
              activeFile={contract}
              blockNum={this.props.blocknum}
              canSave={this.props.contract && this.props.contract.code !== this.state.contract.code}
              handleCheck={this.handleCheck}
              handleSave={this.handleSave}
            />
            <Editor
              mode="ocaml"
              theme="tomorrow"
              fontSize={16}
              onChange={this.onChange}
              name="scilla-editor"
              annotations={this.getAnnotations()}
              height={`${this.state.dimensions.height.toString(10)}px`}
              width={`${this.state.dimensions.width.toString(10)}px`}
              value={contract.code}
              editorProps={{ $blockScrolling: true }}
              readOnly={contract.name.length === 0}
            />
          </Wrapper>
        )}
      </Measure>
    );
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  update: (name: string, code: string) => dispatch(fsActions.update(name, code)),
  check: (code: string, cb?: (res: any) => void) => dispatch(fsActions.check(code, cb)),
});

const mapStateToProps = (state: ApplicationState) => ({
  blocknum: state.blockchain.blockNum,
  contract:
    state.fs.activeContract && state.fs.activeContract.length > 1
      ? state.fs.contracts[state.fs.activeContract]
      : { name: '', code: '' },
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ScillaEditor);
